/* =========================================================
   School for Self Ascension — seed content
   ---------------------------------------------------------
   The activities that currently live hardcoded in index.html, lifted into
   data so the admin panel can own them.

   On first run the store imports this list. After that the stored copy wins,
   so edits made in the admin panel are never overwritten by a redeploy.
   It also doubles as the offline fallback: if the database can't be reached,
   the public site renders from here and still looks complete.

   `id` values are permanent — registrations point at them. Never reuse or
   rename an id; retire an activity by setting published:false instead.
   ========================================================= */
window.SSA_SEED = {
  version: 1,

  activities: [
    /* ---------------- Teacher trainings ---------------- */
    {
      id: 'tr-angels',
      section: 'trainings',
      order: 10,
      published: true,
      title: 'Angels',
      fullTitle: 'Angel Teacher Training',
      kicker: 'Teacher training',
      image: 'assets/img/tr-angels.webp',
      imageAlt: 'Luminous angel wings of light against a lavender sky',
      cardText: 'Be the angelic light that spreads around and into the world.',
      modes: ['in-person', 'online'],
      lead: 'Do you want to teach about Angels? Be the angelic light that spreads around and into the world.',
      body: ['This training programme gives you the knowledge to create and run your own workshops, ceremonies, meditations and healing sessions on Angels.'],
      listTitle: '',
      list: [],
      note: '',
      accreditation: 'Diana Cooper School of White Light, UK',
      dates: [],
      price: null,
      seats: null,
      registrationOpen: true
    },
    {
      id: 'tr-unicorns',
      section: 'trainings',
      order: 20,
      published: true,
      title: 'Unicorns',
      fullTitle: 'Unicorn Teacher Training',
      kicker: 'Teacher training',
      image: 'assets/img/tr-unicorns.webp',
      imageAlt: 'A white unicorn in a misty moonlit forest glade',
      cardText: 'Unicorns are pure beings who connect to our souls.',
      modes: ['online', 'in-person'],
      lead: 'Unicorns are pure beings who connect to our souls.',
      body: ['This training programme gives you the knowledge to create and run your own workshops, ceremonies, meditations and healing sessions on Unicorns.'],
      listTitle: '',
      list: [],
      note: 'Includes the full detailed manual for the Teacher Training Module and the Unicorn Module.',
      accreditation: 'Diana Cooper School of White Light, UK',
      dates: [],
      price: null,
      seats: null,
      registrationOpen: true
    },
    {
      id: 'tr-dragons',
      section: 'trainings',
      order: 30,
      published: true,
      title: 'Dragons',
      fullTitle: 'Dragon Teacher Training',
      kicker: 'Teacher training',
      image: 'assets/img/tr-dragons.webp',
      imageAlt: 'A golden celestial dragon swirling through sunrise clouds',
      cardText: "Connect to the Dragons' realm and spread their light into the world.",
      modes: ['in-person', 'online'],
      lead: "Do you want to connect to the Dragons' realm and spread their light into the world? If you feel a calling to teach about them, this training programme is for you.",
      body: [],
      listTitle: 'In this training',
      list: [
        'Connect with the celestial dragons',
        'Learn — and teach — about them',
        "Spread the Dragons' light",
        'Clearing & healing',
        '…and more'
      ],
      note: '',
      accreditation: 'Diana Cooper School of White Light, UK',
      dates: [],
      price: null,
      seats: null,
      registrationOpen: true
    },
    {
      id: 'tr-atlantis',
      section: 'trainings',
      order: 40,
      published: true,
      title: 'Golden Atlantis',
      fullTitle: 'Golden Atlantis Teacher Training',
      kicker: 'Teacher training',
      image: 'assets/img/tr-atlantis.webp',
      imageAlt: 'A golden crystal city glowing beneath turquoise ocean water',
      cardText: 'Bring wisdom, power and enlightenment into your life and the lives of others.',
      modes: ['online', 'in-person'],
      lead: 'Bring wisdom, power and enlightenment into your own life and the lives of others.',
      body: ['This training programme gives you the knowledge to create and run your own workshops, ceremonies, meditations and healing sessions on the Atlantean Age.'],
      listTitle: '',
      list: [],
      note: '',
      accreditation: 'Diana Cooper School of White Light, UK',
      dates: [],
      price: null,
      seats: null,
      registrationOpen: true
    },
    {
      id: 'tr-lemuria',
      section: 'trainings',
      order: 50,
      published: true,
      title: 'Lemurian Planetary Healing',
      fullTitle: 'Lemurian Planetary Healing Teacher Training',
      kicker: 'Teacher training',
      image: 'assets/img/tr-lemuria.webp',
      imageAlt: 'Snow-capped Mount Shasta under a glowing lenticular cloud at sunrise',
      cardText: 'Connect to your Lemurian roots and share their knowledge with the world.',
      modes: ['in-person', 'online'],
      lead: 'Do you want to connect to the Lemurian Age and spread its knowledge into the world? If you feel a calling to teach about it, this training programme is for you.',
      body: ['Train with Manjula to connect to your Lemurian roots.'],
      listTitle: '',
      list: [],
      note: '',
      accreditation: 'Diana Cooper School of White Light, UK',
      dates: [],
      price: null,
      seats: null,
      registrationOpen: true
    },
    {
      id: 'tr-ascension',
      section: 'trainings',
      order: 60,
      published: true,
      title: 'Ascension',
      fullTitle: 'Ascension Teacher Training',
      kicker: 'Teacher training',
      image: 'assets/img/tr-ascension.webp',
      imageAlt: 'A figure meditating on a mountain ridge above the clouds as a column of light rises',
      cardText: 'Learn to walk — and teach — the Ascension path.',
      modes: ['in-person', 'online'],
      lead: 'Do you want to lead your own workshops and teach others about Ascension? Learn to walk — and teach — the Ascension path.',
      body: [],
      listTitle: "What you'll learn",
      list: [
        'The expertise and skills to facilitate workshops and meditations in a professional manner',
        'How to keep your energies uplifted as you organise and run workshops',
        'A comprehensive understanding of Ascension',
        'The Soul and the Monad',
        'Channelling the Masters',
        'Affirmations, prayers and Degrees',
        'Cosmic Heart meditation and healing',
        '…and more'
      ],
      note: '',
      accreditation: 'Diana Cooper School of White Light, UK',
      dates: [],
      price: null,
      seats: null,
      registrationOpen: true
    },
    {
      id: 'tr-transform',
      section: 'trainings',
      order: 70,
      published: true,
      title: 'Transform Your Life',
      fullTitle: 'Transform Your Life Teacher Training',
      kicker: 'Teacher training',
      image: 'assets/img/tr-violet-flame.webp',
      imageAlt: 'A luminous violet flame rising in darkness',
      cardText: 'Learn — and teach others — to transform.',
      modes: ['online', 'in-person'],
      lead: 'Learn — and teach others — to transform.',
      body: [],
      listTitle: "What you'll learn",
      list: [
        'The Laws of Life',
        'The inner self, the Inner Child and the Shadow self',
        'Abundance, material and spiritual',
        'Your relationship with the physical self and the chakras',
        'A variety of activities and visualisations to heal, uncord and transform — and how to teach them',
        'The Violet Flame and its variations as tools for transformation',
        'Walking the Ascension Pathway',
        'Connecting with the soul and its purpose'
      ],
      note: '',
      accreditation: 'Diana Cooper School of White Light, UK',
      dates: [],
      price: null,
      seats: null,
      registrationOpen: true
    },

    /* ---------------- Courses ---------------- */
    {
      id: 'course-sound-healing',
      section: 'courses',
      order: 10,
      published: true,
      /* This one already has its own designed section on the homepage, so it
         stays out of the trainings gallery to avoid showing twice. Any new
         course Manjula adds appears in the gallery by default. */
      showInGallery: false,
      title: 'Sound Healing — Advance Therapy',
      fullTitle: 'The Art & Science of Sound Healing — Advance Therapy',
      kicker: 'Advance therapy course',
      image: 'assets/img/workshop-circle.webp',
      imageAlt: 'A group meditating in a circle around singing bowls and a lit diya in a bright studio',
      cardText: 'Sound bowls merging with the rhythm of our natural body waves.',
      modes: ['in-person', 'online'],
      lead: 'Learn the techniques to heal yourself, your family and your friends.',
      body: ['Sound bowls merging with the rhythm of our natural body waves.'],
      listTitle: 'Supports your development',
      list: ['Mental', 'Physical', 'Emotional', 'Spiritual'],
      note: '',
      accreditation: 'Sound Healing & Gong Mastery — IASH',
      dates: [],
      price: null,
      seats: null,
      registrationOpen: true
    },

    /* ---------------- Sacred journeys ---------------- */
    {
      id: 'jr-egypt',
      section: 'journeys',
      order: 10,
      published: true,
      title: 'Egypt — Sacred Spiritual Tour',
      fullTitle: 'Egypt — Sacred Spiritual Tour',
      kicker: 'Sacred journey',
      image: 'assets/img/jr-egypt.webp',
      imageAlt: 'Camel riders silhouetted before the Great Pyramids of Giza at sunset',
      cardText: 'A magical journey to discover the mystical wonders of Egypt, with a special private visit to the sacred sites.',
      modes: ['in-person'],
      subtitle: '',
      location: 'Egypt',
      duration: '10 nights · 11 days',
      lead: 'A magical journey to discover the mystical wonders of Egypt, with a special private visit to the sacred sites.',
      body: [],
      listTitle: '',
      list: [
        'Guided energy work',
        'A relaxing cruise in the lap of Goddess Nile',
        'Immersion in Atlantean Ascension light',
        'Goddess Isis ritual',
        "The King's Chamber at the Great Pyramids",
        'Fun, sharing & shopping'
      ],
      quote: '',
      note: '',
      accreditation: '',
      /* Dates carried over from the poster. Manjula replaces these with the
         next tour's dates in the admin panel; past dates show as "closed". */
      dates: [
        { id: 'd1', label: '02 – 11 March 2026', start: '2026-03-02', end: '2026-03-11', mode: 'in-person', seats: null }
      ],
      price: null,
      seats: null,
      registrationOpen: true
    },
    {
      id: 'jr-babaji-cave',
      section: 'journeys',
      order: 20,
      published: true,
      title: "Mahavatar Babaji's Cave",
      fullTitle: "Mahavatar Babaji's Cave",
      kicker: 'Sacred journey',
      image: 'assets/img/jr-babaji-cave.webp',
      imageAlt: 'A rock cave entrance with marigold garlands on a misty forested Himalayan mountainside',
      cardText: "A spiritual journey to Babaji's Cave in Uttarakhand, in the Himalayas — a part of the Sanjeevini Hills.",
      modes: ['in-person'],
      subtitle: 'The path which leads towards the light',
      location: 'Uttarakhand, Himalayas',
      duration: '',
      lead: "A spiritual journey to Babaji's Cave in Uttarakhand, in the Himalayas — a part of the Sanjeevini Hills.",
      body: [],
      listTitle: '',
      list: [
        "Meditation on the Guru Mandala at Mahavatar Babaji's Cave",
        'A visit to the sacred site where initiation happens',
        'Celebrate and experience your connection with your Buddha-self',
        "Immerse in nature at Sri Durga Maa's Temple, Dunagiri",
        'Deep silence on the Ascension path',
        'Food for the body, mind and soul'
      ],
      quote: 'It is inside this cave that the great Mahavatar Babaji initiated his disciple Shyam Charan Lahiri into the ancient meditation system of Kriya Yoga, in 1861.',
      note: '',
      accreditation: '',
      dates: [
        { id: 'd1', label: 'May 2026', start: '2026-05-01', end: '', mode: 'in-person', seats: null }
      ],
      price: null,
      seats: null,
      registrationOpen: true
    }
  ]
};
