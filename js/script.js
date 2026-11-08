// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to a range of 9 days (from 9 days ago to today)
// - Restrict dates to NASA's image archive (starting from 1995)
setupDateInputs(startInput, endInput);

// ---------------------------------------------------------------
// Settings
// ---------------------------------------------------------------

// NASA API key. DEMO_KEY is NASA's public key for trying the API.
// Swap in your own free key from https://api.nasa.gov/ for higher limits.
const API_KEY = 'DEMO_KEY';
const APOD_URL = 'https://api.nasa.gov/planetary/apod';

// Longest range we allow in one request (keeps the gallery a sensible size)
const MAX_DAYS = 30;

// Page elements we use below
const getImagesBtn = document.getElementById('getImagesBtn');
const gallery = document.getElementById('gallery');
const modal = document.getElementById('modal');
const modalMedia = document.getElementById('modalMedia');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');
const modalClose = document.getElementById('modalClose');

// The entries from the most recent fetch, so the modal can look them up
let currentItems = [];

// ---------------------------------------------------------------
// Fix "today" for US time zones
// ---------------------------------------------------------------
// dateRange.js works out "today" in UTC. In the evening in the US, UTC is
// already tomorrow, and NASA rejects a date that hasn't happened yet in
// Eastern Time (where APOD is published). So we cap the pickers at
// today's date in New York instead.
const apodToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

function capAtApodToday() {
  startInput.max = apodToday;
  endInput.max = apodToday;
  if (endInput.value > apodToday) {
    endInput.value = apodToday;
  }
  if (startInput.value > apodToday) {
    startInput.value = apodToday;
  }
}

if (today > apodToday) {
  // Keep the default 9-day window, just shifted back one day
  startInput.value = addDays(apodToday, -8);
}
capAtApodToday();
// dateRange.js sets the end date when the start date changes; this runs after it
startInput.addEventListener('change', capAtApodToday);

// ---------------------------------------------------------------
// LevelUp: random "Did You Know?" space fact
// ---------------------------------------------------------------
const spaceFacts = [
  'One day on Venus is longer than one year on Venus. It spins that slowly.',
  'Neutron stars are so dense that a teaspoon of one would weigh about a billion tons on Earth.',
  'The footprints left on the Moon by the Apollo astronauts will likely last millions of years, because there is no wind to blow them away.',
  'Light from the Sun takes about 8 minutes and 20 seconds to reach Earth.',
  'Jupiter\'s Great Red Spot is a storm wider than Earth that has been raging for at least 190 years.',
  'There are more stars in the universe than grains of sand on all of Earth\'s beaches.',
  'Saturn is less dense than water. In a big enough bathtub, it would float.',
  'The International Space Station circles Earth about every 90 minutes, so its crew sees around 16 sunrises a day.',
  'Olympus Mons on Mars is the tallest volcano in the solar system, nearly three times the height of Mount Everest.',
  'The Voyager 1 spacecraft, launched in 1977, is the most distant human-made object, more than 24 billion kilometers away.',
  'A year on Mercury lasts just 88 Earth days.',
  'The Andromeda Galaxy is heading toward the Milky Way and the two will merge in about 4.5 billion years.'
];

function showRandomFact() {
  const randomIndex = Math.floor(Math.random() * spaceFacts.length);
  document.getElementById('spaceFact').textContent = spaceFacts[randomIndex];
}

showRandomFact();

// ---------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------

// Add (or subtract) days from a "YYYY-MM-DD" string
function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

// Number of days from start to end, counting both ends
function countDays(start, end) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(end) - new Date(start)) / msPerDay) + 1;
}

// Turn "2025-04-18" into "April 18, 2025"
function formatDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Link to the entry's own page on apod.nasa.gov, e.g. ap250418.html
function apodPageUrl(dateString) {
  return `https://apod.nasa.gov/apod/ap${dateString.slice(2).replaceAll('-', '')}.html`;
}

// The entry's page on NASA's site (NASA Science gives us the exact link)
function entryPage(item) {
  return item.page_url || apodPageUrl(item.date);
}

// Make text safe to put inside HTML (titles can contain < or & characters)
function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Show a message in the gallery area (used for loading and errors)
function showMessage(icon, message, extraClass) {
  gallery.innerHTML = `
    <div class="placeholder ${extraClass || ''}">
      <div class="placeholder-icon">${icon}</div>
      <p>${message}</p>
    </div>
  `;
}

// ---------------------------------------------------------------
// Fetching data from NASA's APOD API
// ---------------------------------------------------------------

// NASA's server sometimes times out, so we try a second time before giving up
async function fetchApod(start, end) {
  const url = `${APOD_URL}?api_key=${API_KEY}&start_date=${start}&end_date=${end}&thumbs=true`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return await response.json();
      }

      // 429 = too many requests (rate limit) - retrying will not help
      if (response.status === 429) {
        throw new Error('NASA\'s API rate limit was reached. Please wait a little while and try again.');
      }

      // 400 = NASA did not like the request (usually a date problem)
      if (response.status === 400) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.msg || 'NASA could not use that date range.');
      }

      // Any other error (like 500 or 503): loop around and try again
      if (attempt === 2) {
        throw new Error(`NASA's server is not responding right now (error ${response.status}). Please try again.`);
      }
    } catch (error) {
      // A network failure shows up as a TypeError; retry once, otherwise pass the error on
      if (!(error instanceof TypeError) || attempt === 2) {
        throw error instanceof TypeError
          ? new Error('Could not reach NASA. Check your internet connection and try again.')
          : error;
      }
    }
  }
}

// ---------------------------------------------------------------
// Backup source: NASA Science's APOD archive
// ---------------------------------------------------------------
// In 2026 APOD moved from apod.nasa.gov to science.nasa.gov. Since then the
// APOD API often answers with a placeholder ("NASA Science" and a NASA logo)
// for every date instead of the real picture. When that happens we read the
// same entries straight from science.nasa.gov, which has a public API too.
const SCIENCE_URL = 'https://science.nasa.gov/wp-json/wp/v2/image-article';

// True when the APOD API sent back placeholder entries instead of real ones
function looksBroken(items) {
  return items.length > 0 && items.every((item) =>
    item.title === 'NASA Science' ||
    (item.url || '').includes('nasa-logo') ||
    item.url === 'about:blank'
  );
}

// Turn "&#8211;" style codes in titles into normal characters
function decodeHTML(text) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

// Convert one science.nasa.gov post into the same shape the APOD API uses
function scienceToApod(post) {
  const page = new DOMParser().parseFromString(post.content.rendered, 'text/html');

  // Title: "APOD: 2026 November 8 – Major Fireball Meteor" -> "Major Fireball Meteor"
  const fullTitle = decodeHTML(post.title.rendered);
  const heading = page.querySelector('h1');
  const title = heading ? heading.textContent.trim() : fullTitle.replace(/^APOD:\s*[^–-]*[–-]\s*/, '');

  // Explanation: the description paragraph, without the "Tomorrow's picture" teaser
  const description = page.querySelector('.media-detail-hero__description');
  let explanation = description ? description.textContent : '';
  explanation = explanation.replace(/^\s*Explanation:\s*/, '').split(/Tomorrow.s picture:/)[0].trim();

  const entry = {
    date: post.date.slice(0, 10),
    title: title,
    explanation: explanation,
    page_url: post.link
  };

  // Is it a video? (YouTube/Vimeo embed, or a video file hosted by NASA)
  const iframe = page.querySelector('iframe[src*="youtube"], iframe[src*="vimeo"]');
  const video = page.querySelector('video');
  const featured = post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0];
  const imageUrl = featured && featured.source_url;

  if (iframe) {
    entry.media_type = 'video';
    entry.url = iframe.src.split('?')[0];
    entry.thumbnail_url = imageUrl ? `${imageUrl}?w=700&fit=clip` : '';
  } else if (video && video.querySelector('source')) {
    entry.media_type = 'video';
    entry.url = video.querySelector('source').src;
    entry.thumbnail_url = video.getAttribute('poster') || (imageUrl ? `${imageUrl}?w=700&fit=clip` : '');
  } else if (imageUrl) {
    entry.media_type = 'image';
    entry.url = `${imageUrl}?w=700&fit=clip`; // smaller copy for the gallery
    entry.hdurl = imageUrl;                    // full size for the modal
  } else {
    entry.media_type = 'other';
    entry.url = post.link;
  }

  return entry;
}

async function fetchFromNasaScience(start, end) {
  const fields = 'date,title,link,content,_links,_embedded';
  // "after" skips posts at exactly that time, and older posts are stamped at
  // midnight, so we start one second before the first day
  const url = `${SCIENCE_URL}?search=APOD&after=${addDays(start, -1)}T23:59:59&before=${end}T23:59:59` +
    `&per_page=100&orderby=date&order=asc&_embed=wp:featuredmedia&_fields=${fields}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NASA's servers are not responding right now (error ${response.status}). Please try again.`);
  }
  const posts = await response.json();

  // Keep only the APOD posts (their titles start with "APOD:"), one per day
  const seenDates = [];
  return posts
    .filter((post) => decodeHTML(post.title.rendered).startsWith('APOD:'))
    .filter((post) => {
      const day = post.date.slice(0, 10);
      if (seenDates.includes(day)) {
        return false;
      }
      seenDates.push(day);
      return true;
    })
    .map(scienceToApod);
}

async function getSpaceImages() {
  const start = startInput.value;
  const end = endInput.value;

  // Check the dates before asking NASA
  if (!start || !end) {
    showMessage('📅', 'Please choose both a start date and an end date.', 'error');
    return;
  }
  if (end < start) {
    showMessage('📅', 'The end date needs to be on or after the start date.', 'error');
    return;
  }
  if (countDays(start, end) > MAX_DAYS) {
    showMessage('📅', `Please choose a range of ${MAX_DAYS} days or fewer.`, 'error');
    return;
  }

  // Show the loading message while we wait for NASA
  showMessage('🔄', 'Loading space photos...', 'loading');
  getImagesBtn.disabled = true;

  try {
    let items = [];
    let source = 'NASA APOD API';

    try {
      const data = await fetchApod(start, end);
      // The API returns a single object for a one-day range, so make it a list
      items = Array.isArray(data) ? data : [data];
    } catch (apiError) {
      // A bad date range is the user's to fix, so show that message as-is
      if (apiError.message.includes('Date must be')) {
        throw apiError;
      }
      console.warn('APOD API failed, using NASA Science instead:', apiError.message);
      items = null;
    }

    // Placeholder data or an outage: get the real entries from NASA Science
    if (items === null || looksBroken(items)) {
      items = await fetchFromNasaScience(start, end);
      source = 'NASA Science APOD archive (science.nasa.gov)';
    }

    currentItems = items;
    displayGallery(currentItems, source);
  } catch (error) {
    showMessage('⚠️', escapeHTML(error.message), 'error');
  } finally {
    getImagesBtn.disabled = false;
  }
}

// ---------------------------------------------------------------
// Building the gallery
// ---------------------------------------------------------------

// The picture shown on a gallery card
function cardMediaHTML(item) {
  if (item.media_type === 'image') {
    return `<img src="${item.url}" alt="${escapeHTML(item.title)}" loading="lazy" />`;
  }

  // LevelUp: video entries show a thumbnail (when NASA gives one) with a play badge
  if (item.media_type === 'video') {
    const picture = item.thumbnail_url
      ? `<img src="${item.thumbnail_url}" alt="${escapeHTML(item.title)} (video)" loading="lazy" />`
      : '<div class="media-fallback">🎬</div>';
    return `<div class="video-thumb">${picture}<span class="play-badge">&#9654; Video</span></div>`;
  }

  // Anything else (NASA occasionally posts interactive pages)
  return '<div class="video-thumb"><div class="media-fallback">🌌</div><span class="play-badge">View on NASA</span></div>';
}

function displayGallery(items, source) {
  if (items.length === 0) {
    showMessage('🌑', 'NASA has no pictures for those dates. Try a different range.', 'error');
    return;
  }

  const sourceNote = `<p class="source-note">Showing ${items.length} entr${items.length === 1 ? 'y' : 'ies'} · Source: ${source}</p>`;

  gallery.innerHTML = sourceNote + items.map((item, index) => `
    <button class="gallery-item" data-index="${index}" aria-label="Open ${escapeHTML(item.title)}">
      <div class="gallery-media">${cardMediaHTML(item)}</div>
      <h3>${escapeHTML(item.title)}</h3>
      <p class="item-date">${formatDate(item.date)}</p>
    </button>
  `).join('');

  // If an image fails to load, show a placeholder instead of a broken icon
  gallery.querySelectorAll('img').forEach((img) => {
    img.addEventListener('error', () => {
      img.outerHTML = '<div class="media-fallback">🛰️</div>';
    });
  });
}

// One click listener on the gallery handles every card
gallery.addEventListener('click', (event) => {
  const card = event.target.closest('.gallery-item');
  if (card) {
    openModal(currentItems[Number(card.dataset.index)]);
  }
});

// ---------------------------------------------------------------
// Modal window
// ---------------------------------------------------------------

// Is this a video link we can play inside the page?
function isEmbeddable(url) {
  return /youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\//.test(url || '');
}

function openModal(item) {
  if (item.media_type === 'image') {
    // Use the high-resolution image when NASA provides one
    const fullSize = item.hdurl || item.url;
    modalMedia.innerHTML = `
      <a href="${fullSize}" target="_blank" rel="noopener" title="Open full-size image in a new tab">
        <img src="${fullSize}" alt="${escapeHTML(item.title)}" />
      </a>
    `;
  } else if (item.media_type === 'video' && isEmbeddable(item.url)) {
    // LevelUp: play YouTube / Vimeo videos right inside the modal
    modalMedia.innerHTML = `
      <div class="video-frame">
        <iframe src="${item.url}" title="${escapeHTML(item.title)}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>
      </div>
      <a class="video-link" href="${entryPage(item)}" target="_blank" rel="noopener">Open this entry on NASA's site</a>
    `;
  } else if (item.media_type === 'video' && /\.(mp4|webm)$/i.test(item.url || '')) {
    // LevelUp: video files hosted by NASA play in a normal video player
    modalMedia.innerHTML = `
      <video class="modal-video" src="${item.url}" poster="${item.thumbnail_url || ''}" controls playsinline></video>
      <a class="video-link" href="${entryPage(item)}" target="_blank" rel="noopener">Open this entry on NASA's site</a>
    `;
  } else {
    // Other videos (or non-image entries): a clear link to NASA's page, which plays it
    const thumb = item.thumbnail_url ? `<img src="${item.thumbnail_url}" alt="${escapeHTML(item.title)}" />` : '';
    const link = item.url && item.media_type === 'video' ? item.url : entryPage(item);
    modalMedia.innerHTML = `
      ${thumb}
      <a class="video-link big" href="${link}" target="_blank" rel="noopener">&#9654; Watch / view this entry on NASA's site</a>
    `;
  }

  modalTitle.textContent = item.title;
  modalDate.textContent = formatDate(item.date) + (item.copyright ? ` · © ${item.copyright.trim()}` : '');
  modalExplanation.textContent = item.explanation;

  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  modalClose.focus();
}

function closeModal() {
  modal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  // Clearing the media stops any video that is still playing
  modalMedia.innerHTML = '';
}

modalClose.addEventListener('click', closeModal);

// Clicking the dark background (outside the white box) closes the modal
modal.addEventListener('click', (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

// The Escape key closes the modal too
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
    closeModal();
  }
});

// ---------------------------------------------------------------
// Start everything when the button is clicked
// ---------------------------------------------------------------
getImagesBtn.addEventListener('click', getSpaceImages);
