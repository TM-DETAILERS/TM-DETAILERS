export const DEFAULT_SITE = {
  businessName: 'TM DETAILERS',
  brandTagline: 'Precision in every detail.',
  hero: {
    eyebrow: 'VAUGHAN · TORONTO · GTA',
    title: 'A CLEANER CAR. A BETTER FEELING.',
    description: 'Professional interior and exterior detailing for people who care about the details. Come to us or book a mobile appointment.',
    kicker: 'THE TM STANDARD',
    image: ''
  },
  announcement: { enabled: false, text: 'Limited-time detailing offer — ask us for details.', code: '' },
  contact: {
    phone: '647-906-1701', email: 'detailers.tm@gmail.com', instagram: 'detailers.tm', city: 'Vaughan, Ontario', serviceArea: 'Vaughan & the Greater Toronto Area', hours: 'By appointment', locationNote: 'For mobile appointments, please provide an outdoor water tap and electrical outlet. We bring our own hose and extension cords.', dropoffAddress: ''
  },
  servicesIntro: 'Focused on the details that change how your vehicle looks and feels.',
  services: [
    { id:'interior', number:'01', name:'Interior restoration', description:'Thorough vacuuming and precise interior cleaning, from consoles and door panels to the places most people miss.', icon:'interior' },
    { id:'exterior', number:'02', name:'Exterior hand wash', description:'A careful hand wash, wheel and rim cleaning, door jambs and glass for a crisp, clean finish.', icon:'exterior' },
    { id:'complete', number:'03', name:'Complete detailing', description:'Interior and exterior services together, with extra attention for high-contact surfaces and finishing touches.', icon:'complete' }
  ],
  pricingIntro:'Straightforward rates. Choose the vehicle that fits your appointment.',
  vehicles: [
    { id:'sedan', name:'Sedan', description:'Cars & compact vehicles', price:80 },
    { id:'suv', name:'SUV', description:'Crossovers & SUVs', price:100 },
    { id:'truck', name:'Pickup truck', description:'Pickup trucks', price:120 },
    { id:'van', name:'Van', description:'Passenger & work vans', price:120 },
    { id:'sprinter', name:'Sprinter', description:'Large cargo / Sprinter vans', price:150 }
  ],
  businessPrices:{ sedan:60,suv:60,truck:75,van:75,sprinter:100 },
  galleryTitle:'Proof is in the finish.',
  gallerySubtitle:'Real vehicles. Real TM Detailers work. Check back for fresh transformations.',
  gallery:[],
  booking:{enabled:true,maxPerDay:2,blockedDates:[],notice:'Appointments are requests until confirmed. Mobile details require a water hookup and power outlet.',timeSlots:['09:00','11:00','13:00','15:00','17:00']},
  about:{eyebrow:'THE DIFFERENCE IS IN THE DETAILS',title:'We take clean seriously.',body:'TM Detailers is a local detailing business built around careful work, clear communication and an experience worth coming back for.',points:['Clear, upfront pricing','Interior + exterior options','Service at your location or ours']},
  sections:{services:true,pricing:true,gallery:true,about:true,booking:true},
  theme:'default',
  themeProfiles:{
    default:{greeting:'',headline:'',description:'',heroImage:'',prices:{}},
    eid:{greeting:'Eid Mubarak',headline:'A FRESH START. A FINER FINISH.',description:'Celebrate with a vehicle that feels renewed.',heroImage:'',prices:{}},
    thanksgiving:{greeting:'Happy Thanksgiving',headline:'A LITTLE MORE TO BE THANKFUL FOR.',description:'Seasonal care for every journey home.',heroImage:'',prices:{}},
    christmas:{greeting:'Merry Christmas',headline:'MAKE EVERY ARRIVAL FEEL SPECIAL.',description:'Holiday-ready detailing, with the same TM standard.',heroImage:'',prices:{}},
    halloween:{greeting:'Happy Halloween',headline:'DETAILS WORTH A SECOND LOOK.',description:'A darker seasonal look. Exceptional care.',heroImage:'',prices:{}},
    newyear:{greeting:'Happy New Year',headline:'START THE YEAR IN FRESH CONDITION.',description:'A clean beginning, down to the last detail.',heroImage:'',prices:{}}
  },
  accent:'#b49b78'
};
