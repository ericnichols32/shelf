import { useRef, useState } from 'react'
import { sortForMove } from '../reorder'
import type { Item } from '../types'

/**
 * The list as plain lines, dragged into the order you want.
 *
 * Cards are lovely to look at and miserable to reorder — they are big, they
 * wrap across columns, and "the one before" stops meaning anything. So
 * arranging drops all that and shows one title a line.
 *
 * The dragging is done with pointer events rather than HTML5 drag-and-drop,
 * which iOS does not implement at all. Rows are a fixed height, so where a row
 * has been dragged to is a division rather than a hit test.
 */
export default function ArrangeList({
  items,
  onReorder,
}: {
  items: Item[]
  onReorder: (id: string, sort: number) => void
}) {
  const list = useRef<HTMLUListElement>(null)
  const [drag, setDrag] = useState<{
    index: number
    startY: number
    y: number
  } | null>(null)

  const rowHeight = () =>
    (list.current?.firstElementChild as HTMLElement)?.offsetHeight ?? 48

  /** How many places the dragged row has travelled, clamped to the list. */
  const shift = (state: { index: number; startY: number; y: number }) => {
    const places = Math.round((state.y - state.startY) / rowHeight())
    const target = state.index + places
    return Math.max(0, Math.min(items.length - 1, target)) - state.index
  }

  const start = (index: number) => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ index, startY: e.clientY, y: e.clientY })
  }

  const move = (e: React.PointerEvent) => {
    if (drag) setDrag({ ...drag, y: e.clientY })
  }

  const end = () => {
    if (!drag) return
    const to = drag.index + shift(drag)
    const sort = sortForMove(items, drag.index, to)
    if (sort !== null) onReorder(items[drag.index].id, sort)
    setDrag(null)
  }

  /** Where a row sits while another is being dragged over it. */
  const offsetFor = (index: number) => {
    if (!drag) return 0
    const places = shift(drag)
    if (index === drag.index) return drag.y - drag.startY
    const to = drag.index + places
    if (places > 0 && index > drag.index && index <= to) return -rowHeight()
    if (places < 0 && index < drag.index && index >= to) return rowHeight()
    return 0
  }

  return (
    <ul className="arrangelist" ref={list}>
      {items.map((item, index) => (
        <li
          key={item.id}
          className={`arrangerow ${drag?.index === index ? 'arrangerow--lifted' : ''}`}
          style={{ transform: `translateY(${offsetFor(index)}px)` }}
        >
          <button
            className="arrangerow__grip"
            aria-label={`Move ${item.title}`}
            onPointerDown={start(index)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          >
            <span aria-hidden="true">⣿</span>
          </button>
          <span className="arrangerow__text">
            <b>{item.title}</b>
            {item.creator && <> &mdash; {item.creator}</>}
          </span>
          <span className="arrangerow__n label">{index + 1}</span>
        </li>
      ))}
    </ul>
  )
}
