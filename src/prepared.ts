// Lists prepared in advance, ready to be added in one go.
//
// These exist as code rather than as rows typed into a browser for one reason:
// until the Firestore setup in the README is done, the collection lives in a
// single browser's storage and can be lost. A list kept here can always be put
// back, and is versioned along with everything else.

import { EMPTY_ITEM, type CategoryId, type NewItem } from './types'

const item = (fields: Partial<NewItem>): NewItem => ({ ...EMPTY_ITEM, ...fields })

/** Cover art from blu-ray.com, which has every release and allows its pixels
 *  to be read — so these can be cut out and matched in size like any other. */
const cover = (id: string) =>
  `https://images.static-bluray.com/movies/covers/${id}_front.jpg`

const disc = (
  title: string,
  creator: string,
  year: string,
  id: string,
  tag = 'Regular Blu-ray',
): NewItem =>
  item({
    category: 'bluray',
    status: 'owns',
    title,
    creator,
    year,
    tag,
    cover: cover(id),
    cutout: true,
  })

const book = (
  tag: string,
  title: string,
  creator: string,
  year = '',
  coverId = '',
  isbn = '',
): NewItem =>
  item({
    category: 'books',
    status: 'wants',
    title,
    creator,
    year,
    tag,
    // An ISBN here is one McNally Jackson was checked to actually stock, so
    // the buy button goes straight to their page for it. Without one the app
    // falls back to a Bookshop search.
    ref: isbn,
    cover: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : '',
  })

export const PREPARED: Partial<Record<CategoryId, NewItem[]>> = {
  bluray: [
    disc('Transformers: Dark of the Moon', 'Michael Bay', '2011', '41038'),
    disc('The Bourne Ultimatum', 'Paul Greengrass', '2007', '148301'),
    disc('2001: A Space Odyssey', 'Stanley Kubrick', '1968', '224399'),
    disc('Casino Royale', 'Martin Campbell', '2006', '281306'),
    disc('Reservoir Dogs', 'Quentin Tarantino', '1992', '335393'),
    disc('Blade Runner', 'Ridley Scott', '1982', '18392'),
    disc('Blade Runner 2049', 'Denis Villeneuve', '2017', '189774', '4K'),
    disc('Star Trek Into Darkness', 'J.J. Abrams', '2013', '73337'),
    disc('Avatar', 'James Cameron', '2009', '10629'),
    disc('The Lord of the Rings: The Return of the King', 'Peter Jackson', '2003', '60349'),
    disc('Guardians of the Galaxy', 'James Gunn', '2014', '109831'),
    disc('Rocketman', 'Dexter Fletcher', '2019', '250977'),
    disc('Harry Potter and the Goblet of Fire', 'Mike Newell', '2005', '367'),
    disc('The Dark Knight', 'Christopher Nolan', '2008', '100748'),
    disc('Rogue One: A Star Wars Story', 'Gareth Edwards', '2016', '247564'),
    disc('Star Wars: The Force Awakens', 'J.J. Abrams', '2015', '151827'),
    disc('Prometheus', 'Ridley Scott', '2012', '103980'),
    disc('Kill Bill: Vol. 1', 'Quentin Tarantino', '2003', '90720'),
    disc('Kill Bill: Vol. 2', 'Quentin Tarantino', '2004', '90721'),
    disc('Iron Man 2', 'Jon Favreau', '2010', '13501'),
    disc('The Hunger Games', 'Gary Ross', '2012', '40952'),
    disc('Sixteen Candles', 'John Hughes', '1984', '41390'),
    disc("Ferris Bueller's Day Off", 'John Hughes', '1986', '61629'),
    disc('The Grand Budapest Hotel', 'Wes Anderson', '2014', '98819', 'Criterion'),
  ],

  books: [
    // — Graphic novels —
    book('Graphic Novel', 'The World of Edena', 'Moebius (Jean Giraud)', '2016', '14831254', '9781506702162'),
    book('Graphic Novel', 'The Incal', 'Moebius & Alejandro Jodorowsky', '2015', '10622894', '9781594650932'),

    // — Novels —
    book('Novel', 'A Different Kind of Power', 'Jacinda Ardern', '2025', '15108022'),
    book('Novel', 'Ready Player Two', 'Ernest Cline', '2020', '10250001', '9781524761349'),
    book('Novel', 'Armada', 'Ernest Cline', '2015', '7421644'),
    book('Novel', 'Lost in the Cosmos', 'Walker Percy', '1983', '6807080', '9780671630065'),
    book('Novel', 'Train to Pakistan', 'Khushwant Singh', '1956', '568646'),
    book('Novel', 'Honey', 'Isabel Banta', '2024', '15187508'),
    book('Novel', 'Kaikeyi', 'Vaishnavi Patel', '2022', '13315015', '9780759557307'),
    book('Novel', 'A Marvellous Light', 'Freya Marske', '2021', '12501220'),
    book('Novel', 'Moonbound', 'Robin Sloan', '2024', '14633560', '9781250390509'),
    book('Novel', 'A Song to Drown Rivers', 'Ann Liang', '2024', '14840493', '9781250908377'),

    // — Coffee table —
    book('Coffee table', 'Temporary Pleasure: Nightclub Architecture', 'John Leo Gillen', '2023', '14736930', '9783791387987'),
    book('Coffee table', 'On the Dancefloor: Spinning Out Onscreen', ''),
    book('Coffee table', 'Dune: Exposures', 'Josh Brolin & Greig Fraser', '2023'),
    book('Coffee table', 'Verner Panton', 'Ida Engholm', '2015', '8839029', '9780714877167'),
    book('Coffee table', 'AREA: 1983–1987', ''),
    book('Coffee table', 'Flower Love', 'Kristen Griffith-VanderYacht'),
    book('Coffee table', 'Love Hotels', 'Kyoichi Tsuzuki', '2008'),
    book('Coffee table', 'Designing with Dried Flowers', 'Hannah Rose Rivers Muller', '2024', '', '9780593580981'),
    book('Coffee table', 'The Art of the SNL Portrait', 'Mary Ellen Matthews', '2025', '15088469', '9781419782534'),
    book('Coffee table', 'The Art and Making of Arcane', 'Elisabeth Vincentelli'),
    book('Coffee table', 'I Make Shoes', 'Salehe Bembury', '2025', '', '9780847844968'),
    book('Coffee table', 'New Floating World: Contemporary Japanese Art and Illustration', ''),
    book('Coffee table', 'The Maximalist: Colorful Interiors for Bold Living', 'Dani Dazey'),
    book('Coffee table', 'Reflections: On Cinematography', 'Roger Deakins', '2025', '15204281', '9781538771501'),
    book('Coffee table', 'Mythology Land', 'Claire Cock-Starkey'),

    // — Cookbooks —
    book('Cookbook', 'Fusão: Untraditional Recipes Inspired by Brazil', 'Ixta Belfrage', '2025', '', '9781623715885'),
    book('Cookbook', 'Salsa Daddy', 'Rick Martínez', '2025', '15131030', '9780593798935'),
    book('Cookbook', 'CDMX: The Food of Mexico City', 'Rosa Cienfuegos', '2023', '', '9781922754585'),
    book('Cookbook', 'Party Tricks', 'Anna Hezel'),
  ],
}
