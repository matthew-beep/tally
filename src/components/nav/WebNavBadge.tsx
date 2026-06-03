interface Props {
  badge?: 'dot' | number
  ring: string
  inline?: boolean
}

export function WebNavBadge({ badge, ring, inline = false }: Props) {
  if (badge === 'dot') {
    return (
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: '#EE5A47',
          boxShadow: `0 0 0 2px ${ring}`,
          flexShrink: 0,
        }}
      />
    )
  }
  if (typeof badge === 'number' && badge > 0) {
    return (
      <span
        style={{
          minWidth: 17,
          height: 17,
          padding: '0 5px',
          boxSizing: 'border-box',
          borderRadius: 999,
          background: '#EE5A47',
          color: '#fff',
          fontSize: 10,
          fontWeight: 800,
          lineHeight: '17px',
          textAlign: 'center',
          fontFamily: 'var(--font-jakarta), "Plus Jakarta Sans", system-ui',
          flexShrink: 0,
          marginLeft: inline ? 'auto' : 0,
        }}
      >
        {badge > 9 ? '9+' : badge}
      </span>
    )
  }
  return null
}
