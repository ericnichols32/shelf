import { CATEGORIES } from '../categories'
import { go } from '../route'

/**
 * Where the plus button on the home page lands: the same list of shelves, asked
 * as a question. Adding needs to know which shelf before it can ask anything
 * else, because every shelf labels its fields differently.
 */
export default function ChooseShelf() {
  return (
    <>
      <span className="label">Add something</span>
      <h1 className="cathead__name">Which shelf?</h1>

      <nav className="shelves">
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            className="shelf"
            onClick={() => go(`/c/${category.id}/new`)}
          >
            <span className="shelf__name">{category.name}</span>
            <span className="shelf__arrow" aria-hidden="true">
              &rarr;
            </span>
          </button>
        ))}
      </nav>
    </>
  )
}
