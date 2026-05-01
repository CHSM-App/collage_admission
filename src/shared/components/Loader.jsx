export default function Loader({ size = 'md' }) {
  const sizeClass = size === 'sm' ? 'h-4 w-4' : 'h-8 w-8'

  return (
    <span
      className={`${sizeClass} inline-block animate-spin rounded-full border-2 border-current border-r-transparent`}
      aria-label="Loading"
      role="status"
    />
  )
}
