import test from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { authenticate, requireAdmin } from '../src/middleware/auth.js';
import { createMongoClient, unavailable } from '../src/db/mongo.js';

function response(error) {
  let status;
  let body;
  errorHandler(
    error,
    {},
    {
      status(value) {
        status = value;
        return this;
      },
      json(value) {
        body = value;
      },
    },
    () => {}
  );
  return { status, body };
}

test('database failures never include messages or error metadata in API responses', () => {
  const error = Object.assign(new Error('private database diagnostic'), {
    code: 'P2003',
    errors: ['private'],
  });
  assert.deepEqual(response(error), {
    status: 500,
    body: { success: false, message: 'Internal server error' },
  });
});

test('malformed JSON does not echo request data', () => {
  assert.equal(
    response(Object.assign(new Error('private request'), { status: 400, type: 'entity.parse.failed' }))
      .body.message,
    'Invalid JSON body'
  );
});

test('non-HTTP status codes are coerced to a generic 500 response', () => {
  assert.deepEqual(response(Object.assign(new Error('secret stack'), { status: 'boom' })), {
    status: 500,
    body: { success: false, message: 'Internal server error' },
  });
});

test('service-unavailable responses stay generic', () => {
  assert.deepEqual(response(unavailable()), {
    status: 503,
    body: { success: false, message: 'Service temporarily unavailable' },
  });
});

test('client errors may surface their safe message without nested metadata', () => {
  assert.deepEqual(
    response(Object.assign(new Error('Invalid cart items or version.'), { status: 400, errors: ['x'] })),
    { status: 400, body: { success: false, message: 'Invalid cart items or version.' } }
  );
});

test('authenticate rejects missing and invalid session cookies without leaking details', async () => {
  const cases = [
    {},
    { cookie: '' },
    { cookie: 'volteniq_session=not-a-session' },
    { cookie: 'volteniq_session=abcd' },
    { authorization: 'Bearer ignored-for-sessions' },
  ];

  for (const headers of cases) {
    let status;
    let body;
    await authenticate(
      { headers },
      {
        status(value) {
          status = value;
          return this;
        },
        json(value) {
          body = value;
        },
      },
      () => {
        throw new Error('next should not run');
      }
    );
    assert.equal(status, 401);
    assert.equal(body.success, false);
    assert.equal(body.message, 'Authentication required');
  }
});

test('requireAdmin blocks non-admin callers', () => {
  let status;
  let body;
  requireAdmin(
    { user: { role: 'USER' } },
    {
      status(value) {
        status = value;
        return this;
      },
      json(value) {
        body = value;
      },
    },
    () => {
      throw new Error('next should not run');
    }
  );
  assert.deepEqual({ status, body }, {
    status: 403,
    body: { success: false, message: 'Admin access required' },
  });
});

test('Mongo client rejects placeholder credentials and non-Atlas remote URIs', () => {
  assert.throws(() => createMongoClient('mongodb+srv://user:<db_password>@cluster.example.net'), /password placeholder/);
  assert.throws(() => createMongoClient('mongodb://user:pass@example.com:27017'), /Atlas SRV URI or local test/);
  assert.doesNotThrow(() => createMongoClient('mongodb://qa:qa@127.0.0.1:27017/volteniq_store'));
});
