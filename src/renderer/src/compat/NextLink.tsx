import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface NextLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string
  children?: ReactNode
}

const NextLink = forwardRef<HTMLAnchorElement, NextLinkProps>(
  ({ href, children, ...props }, ref) => {
    return (
      <Link ref={ref} to={href} {...props}>
        {children}
      </Link>
    )
  }
)

NextLink.displayName = 'NextLink'

export default NextLink
