import { CATEGORIES } from '../categories'
import { go } from '../route'
import type { Item } from '../types'

export default function Home({ items }: { items: Item[] }) {
  return (
    <>
      <h1 className="wordmark">
        Eric&rsquo;s Collection{' '}
        <span className="wordmark__amp">&amp;</span> Wish List
      </h1>
      <p className="tagline">
        A running log of what I own, and a short list of what I am still after.
      </p>

      <nav className="shelves">
        {CATEGORIES.map((category) => {
          const mine = items.filter((i) => i.category === category.id)
          const owns = mine.filter((i) => i.status === 'owns').length
          const wants = mine.length - owns
          return (
            <button
              key={category.id}
              className="shelf"
              onClick={() => go(`/c/${category.id}`)}
            >
              <span className="shelf__name">{category.name}</span>
              <span className="shelf__arrow" aria-hidden="true">
                &rarr;
              </span>
              <span className="shelf__counts label">
                {owns} owns
                {wants > 0 && <> &middot; {wants} wants</>}
              </span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
