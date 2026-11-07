export default function Container({ as: Tag = 'div', className = '', children, narrow = false }) {
  return (
    <Tag className={`container-shell ${narrow ? 'container-shell--narrow' : ''} ${className}`.trim()}>
      {children}
    </Tag>
  )
}
