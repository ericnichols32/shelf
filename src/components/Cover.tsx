import { useEffect, useState } from 'react'
import { cutFill, cutRatio, type Category } from '../categories'
import { cutOutBackground } from '../cutout'
import type { Item } from '../types'

/**
 * An item's picture — or, when there is no picture, its title set large on
 * sand. The blank is the common case early on, so it is designed rather than
 * left as a grey box.
 *
 * With `cutout` set, the white surround is taken off so the box sits on the
 * card itself. When the image's host won't allow that, the picture is shown
 * whole; in a light theme a multiply blend gets most of the way there anyway,
 * since white against warm paper simply disappears.
 */
export default function Cover({
  item,
  category,
  className,
}: {
  item: Pick<Item, 'cover' | 'title' | 'creator' | 'cutout'>
  category: Category
  className: string
}) {
  const [broken, setBroken] = useState(false)
  const [shown, setShown] = useState(false)
  const [cut, setCut] = useState<string | null>(null)
  const [refused, setRefused] = useState(false)

  useEffect(() => {
    setBroken(false)
    setShown(false)
  }, [item.cover])

  // Deliberately waits for the plain picture to be on screen first.
  //
  // The cut-out attempt asks for the same URL again with cross-origin access,
  // and a host that refuses leaves a failed entry in the browser's image cache
  // that a plain <img> will then reuse — so probing first makes the picture
  // vanish altogether rather than merely stay uncut. Going second costs
  // nothing and cannot do that.
  useEffect(() => {
    setCut(null)
    setRefused(false)
    if (!item.cutout || !item.cover || !shown) return
    let live = true
    cutOutBackground(item.cover, cutRatio(category), cutFill(category)).then((result) => {
      if (!live) return
      if (result.ok) setCut(result.url)
      else setRefused(true)
    })
    return () => {
      live = false
    }
  }, [item.cutout, item.cover, shown, category])

  const cutMode = item.cutout && !broken && item.cover

  const style = {
    ['--ratio' as string]: String(
      cutMode ? cutRatio(category) : category.ratio,
    ),
  } as React.CSSProperties
  const classes = [
    className,
    cutMode ? 'art--cut' : '',
    cutMode && refused ? 'art--cut-blend' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} style={style}>
      {item.cover && !broken ? (
        <img
          src={cut ?? item.cover}
          alt={item.title}
          loading="lazy"
          onLoad={() => setShown(true)}
          // Only the original failing means there is nothing to show; a
          // cut-out that fails to render just falls back to it.
          onError={() => (cut ? setCut(null) : setBroken(true))}
        />
      ) : (
        <div className="card__blank">
          <span className="label">{category.name}</span>
          <span>
            <span className="card__blank-title">{item.title || 'Untitled'}</span>
            {item.creator && (
              <span className="card__blank-creator">{item.creator}</span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}
