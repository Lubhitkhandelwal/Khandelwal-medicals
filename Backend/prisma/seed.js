// prisma/seed.js
// Run: node prisma/seed.js
// Seeds the DB with sample OTC products and store config

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const products = [
  // Pain Relief
  { name: "Dolo 650", brand: "Micro Labs", category: "Pain Relief", mrp: 30, price: 27, stock: 100, unit: "strip of 15", description: "Paracetamol 650mg — fever & mild pain" },
  { name: "Combiflam", brand: "Sanofi", category: "Pain Relief", mrp: 45, price: 40, stock: 80, unit: "strip of 20", description: "Ibuprofen + Paracetamol — pain & inflammation" },
  { name: "Volini Gel", brand: "Sun Pharma", category: "Pain Relief", mrp: 199, price: 165, stock: 40, unit: "30g tube", description: "Topical pain relief gel for muscle & joint pain" },
  { name: "Moov Cream", brand: "Reckitt", category: "Pain Relief", mrp: 120, price: 99, stock: 50, unit: "50g tube", description: "Fast relief from back pain, joint pain" },

  // Vitamins & Supplements
  { name: "Revital H", brand: "Sun Pharma", category: "Vitamins", mrp: 299, price: 245, stock: 60, unit: "bottle of 30", description: "Daily multivitamin with ginseng" },
  { name: "Limcee 500", brand: "Abbott", category: "Vitamins", mrp: 40, price: 35, stock: 120, unit: "strip of 15", description: "Vitamin C 500mg chewable tablets" },
  { name: "Shelcal 500", brand: "Torrent", category: "Vitamins", mrp: 185, price: 155, stock: 0, unit: "strip of 15", description: "Calcium + Vitamin D3 supplement", },
  { name: "Neurobion Forte", brand: "Merck", category: "Vitamins", mrp: 45, price: 38, stock: 90, unit: "strip of 30", description: "Vitamin B Complex — nerve & energy health" },

  // Cold & Cough
  { name: "Sinarest", brand: "Centaur", category: "Cold & Cough", mrp: 55, price: 48, stock: 70, unit: "strip of 10", description: "Nasal congestion, cold & sinusitis relief" },
  { name: "Benadryl Cough Syrup", brand: "Johnson & Johnson", category: "Cold & Cough", mrp: 99, price: 82, stock: 45, unit: "100ml bottle", description: "Dry & wet cough syrup" },
  { name: "Vicks VapoRub", brand: "Procter & Gamble", category: "Cold & Cough", mrp: 89, price: 75, stock: 55, unit: "50ml jar", description: "Topical nasal decongestant & cough suppressant" },

  // Skin Care
  { name: "Candid Powder", brand: "Glenmark", category: "Skin Care", mrp: 115, price: 95, stock: 35, unit: "75g bottle", description: "Antifungal dusting powder" },
  { name: "Betadine Solution", brand: "Win-Medicare", category: "Skin Care", mrp: 75, price: 62, stock: 60, unit: "100ml bottle", description: "Antiseptic povidone-iodine solution" },
  { name: "Lacto Calamine", brand: "Piramal", category: "Skin Care", mrp: 130, price: 108, stock: 40, unit: "60ml lotion", description: "Skin soothing lotion for oily skin" },

  // Devices & Essentials
  { name: "Accu-Chek Active Strips", brand: "Roche", category: "Devices", mrp: 850, price: 720, stock: 25, unit: "box of 50", description: "Blood glucose test strips" },
  { name: "Dr. Morepen BP Monitor", brand: "Dr. Morepen", category: "Devices", mrp: 1499, price: 1199, stock: 10, unit: "piece", description: "Automatic digital BP monitor" },

  // Digestive
  { name: "Digene Gel", brand: "Abbott", category: "Digestive", mrp: 165, price: 138, stock: 50, unit: "200ml bottle", description: "Antacid for acidity & heartburn" },
  { name: "ORS Electral", brand: "Franco-Indian", category: "Digestive", mrp: 35, price: 30, stock: 100, unit: "sachet pack of 5", description: "Oral rehydration salts" },
  { name: "Pudin Hara", brand: "Dabur", category: "Digestive", mrp: 60, price: 52, stock: 70, unit: "strip of 10", description: "Gas & indigestion relief capsules" },

  // Eye & Ear
  { name: "Optrex Eye Drops", brand: "Reckitt", category: "Eye & Ear", mrp: 120, price: 98, stock: 30, unit: "10ml bottle", description: "Refreshing eye drops for dryness & irritation" },
  { name: "Waxsolv Ear Drops", brand: "Cipla", category: "Eye & Ear", mrp: 75, price: 62, stock: 25, unit: "10ml bottle", description: "Ear wax softening drops" },
];

async function main() {
  console.log("🌱 Seeding database...");

  // Upsert store config
  await prisma.storeConfig.upsert({
    where: { id: "store" },
    update: {},
    create: {
      id: "store",
      name: "Khandelwal Medicals",
      address: "Khandelwal Medicals, Sonkh Road, Kumher, 321201",
      phone: "6378966072",
      deliveryCharge: 40,
      minOrderFree: 500,
    },
  });
  console.log("✅ Store config seeded");

  // Seed products
  for (const product of products) {
    await prisma.product.create({ data: product });
  }
  console.log(`✅ ${products.length} products seeded`);

  console.log("🎉 Done! Run: npm run db:studio to browse your data");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
