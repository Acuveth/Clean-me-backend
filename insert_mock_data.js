const pool = require('./config/database');

async function insertLjubljanaMockData() {
  console.log('🚀 Starting Ljubljana mock data insertion...');
  
  try {
    // First, let's create a mock user if it doesn't exist (for testing purposes)
    await pool.execute(`
      INSERT IGNORE INTO users (id, email, name, points, total_reports, created_at) 
      VALUES (1, 'test@ljubljana.si', 'Ljubljana Tester', 100, 15, NOW())
    `);
    console.log('✅ Mock user created/verified');

    // Insert mock trash reports around Ljubljana
    const mockReports = [
      // City Center locations
      [1, 46.0514, 14.5059, '/mock/trash1.jpg', 'Plastic bottles and food wrappers', 'Plastic', 'Medium', 'pending', 25, 
       'Multiple plastic bottles and food containers scattered near the fountain', 3, 
       JSON.stringify(['Plastic Bottle', 'Food Container', 'Wrapper']), 'medium', 'Prešeren Square fountain area', 1],

      [1, 46.0488, 14.5058, '/mock/trash2.jpg', 'Cigarette butts and paper waste', 'General', 'Small', 'pending', 15,
       'Collection of cigarette butts and paper litter near bus stop', 8,
       JSON.stringify(['Cigarette Butts', 'Paper', 'Napkins']), 'low', 'Bus stop on Slovenska cesta', 1],

      // Tivoli Park area
      [1, 46.0536, 14.4945, '/mock/trash3.jpg', 'Picnic waste and bottles', 'Mixed', 'Large', 'pending', 40,
       'Large amount of picnic waste including bottles, plates, and organic waste', 12,
       JSON.stringify(['Glass Bottle', 'Plastic Plates', 'Food Waste', 'Paper Napkins']), 'high', 'Tivoli Park picnic area', 1],

      [1, 46.0578, 14.4962, '/mock/trash4.jpg', 'Dog waste bags and bottles', 'Organic', 'Small', 'pending', 12,
       'Improperly disposed dog waste bags near walking path', 2,
       JSON.stringify(['Plastic Bags', 'Organic Waste']), 'medium', 'Tivoli Park walking trail', 1],

      // Ljubljana Castle area
      [1, 46.0492, 14.5085, '/mock/trash5.jpg', 'Tourist litter and cans', 'Metal', 'Medium', 'pending', 30,
       'Metal cans and tourist waste with beautiful castle view in background', 4,
       JSON.stringify(['Metal Cans', 'Plastic Bottles', 'Paper Maps']), 'medium', 'Ljubljana Castle viewpoint', 1],

      // Ljubljanica River area
      [1, 46.0495, 14.5077, '/mock/trash6.jpg', 'Riverbank litter', 'Plastic', 'Medium', 'pending', 28,
       'Plastic waste along the beautiful Ljubljanica riverbank', 5,
       JSON.stringify(['Plastic Bottles', 'Food Containers', 'Straws']), 'medium', 'Ljubljanica River embankment', 1],

      [1, 46.0501, 14.5089, '/mock/trash7.jpg', 'Market waste', 'Organic', 'Large', 'pending', 35,
       'Organic waste from Central Market including fruit peels and vegetables', 15,
       JSON.stringify(['Fruit Peels', 'Vegetables', 'Paper Bags', 'Plastic Bags']), 'high', 'Central Market area', 1],

      // University area
      [1, 46.0531, 14.5089, '/mock/trash8.jpg', 'Student area litter', 'General', 'Medium', 'pending', 22,
       'Mixed litter in university district including coffee cups and study materials', 6,
       JSON.stringify(['Coffee Cups', 'Paper', 'Plastic Bottles', 'Food Wrappers']), 'medium', 'University of Ljubljana campus', 1],

      // Metelkova area (cultural district)
      [1, 46.0547, 14.5151, '/mock/trash9.jpg', 'Cultural district waste', 'Mixed', 'Small', 'pending', 18,
       'Artistic and cultural area litter near alternative venues', 4,
       JSON.stringify(['Beer Bottles', 'Cigarette Butts', 'Paper Flyers']), 'low', 'Metelkova cultural district', 1],

      // Dragon Bridge area
      [1, 46.0517, 14.5086, '/mock/trash10.jpg', 'Bridge tourist waste', 'Plastic', 'Small', 'pending', 20,
       'Tourist litter near the famous Dragon Bridge', 3,
       JSON.stringify(['Plastic Bottles', 'Tourist Maps', 'Food Wrappers']), 'medium', 'Dragon Bridge tourist area', 1],

      // BTC shopping area
      [1, 46.0743, 14.5376, '/mock/trash11.jpg', 'Shopping center waste', 'Plastic', 'Large', 'pending', 45,
       'Large accumulation of shopping bags and food containers', 18,
       JSON.stringify(['Shopping Bags', 'Food Containers', 'Straws', 'Receipts']), 'high', 'BTC City shopping area', 1],

      // Rožnik Hill area
      [1, 46.0621, 14.4834, '/mock/trash12.jpg', 'Hiking trail litter', 'Mixed', 'Small', 'pending', 16,
       'Litter left by hikers on popular Rožnik Hill trail', 3,
       JSON.stringify(['Energy Bar Wrappers', 'Plastic Bottles', 'Tissues']), 'low', 'Rožnik Hill hiking trail', 1],

      // Črnuče area (northern Ljubljana)
      [1, 46.0899, 14.5234, '/mock/trash13.jpg', 'Residential area waste', 'General', 'Medium', 'pending', 24,
       'Mixed residential waste near apartment buildings', 7,
       JSON.stringify(['Plastic Bags', 'Food Containers', 'Paper', 'Glass']), 'medium', 'Črnuče residential area', 1],

      // Šiška area
      [1, 46.0734, 14.4867, '/mock/trash14.jpg', 'Park playground litter', 'Plastic', 'Small', 'pending', 14,
       'Children playground area with scattered plastic toys and snack wrappers', 5,
       JSON.stringify(['Plastic Toys', 'Snack Wrappers', 'Juice Boxes']), 'low', 'Šiška district playground', 1],

      // Bežigrad area
      [1, 46.0712, 14.5178, '/mock/trash15.jpg', 'Sports facility waste', 'Mixed', 'Medium', 'pending', 26,
       'Sports equipment and energy drink containers near athletic facilities', 4,
       JSON.stringify(['Energy Drink Cans', 'Sports Equipment', 'Towels']), 'medium', 'Bežigrad sports complex', 1]
    ];

    // Insert all pending reports
    for (const report of mockReports) {
      await pool.execute(`
        INSERT INTO trash_reports (
          user_id, latitude, longitude, photo_url, description, trash_type, size, 
          status, points, ai_description, trash_count, trash_types, severity, 
          location_context, ai_analyzed, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? HOUR))
      `, [...report, Math.floor(Math.random() * 24) + 1]); // Random hours between 1-24
    }

    console.log('✅ Pending trash reports inserted');

    // Add some cleaned trash entries
    const cleanedReports = [
      [1, 46.0525, 14.5043, '/mock/cleaned1.jpg', 'Successfully cleaned plastic waste', 'Plastic', 'Medium', 'cleaned', 25,
       'Plastic bottles and containers that were successfully collected', 4,
       JSON.stringify(['Plastic Bottles', 'Food Containers']), 'medium', 'Triple Bridge area', 1, 1],

      [1, 46.0483, 14.5123, '/mock/cleaned2.jpg', 'Park area cleaned up', 'Mixed', 'Large', 'cleaned', 38,
       'Large cleanup effort in park area with mixed waste types', 12,
       JSON.stringify(['Mixed Waste', 'Organic Matter', 'Plastic', 'Paper']), 'high', 'Zvezda Park', 1, 1]
    ];

    for (const report of cleanedReports) {
      await pool.execute(`
        INSERT INTO trash_reports (
          user_id, latitude, longitude, photo_url, description, trash_type, size, 
          status, points, ai_description, trash_count, trash_types, severity, 
          location_context, ai_analyzed, cleaned_by, cleaned_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), DATE_SUB(NOW(), INTERVAL ? DAY))
      `, [...report, Math.floor(Math.random() * 3) + 1]); // Random days between 1-3
    }

    console.log('✅ Cleaned trash reports inserted');

    // Get statistics
    const [totalStats] = await pool.execute(`
      SELECT COUNT(*) as total FROM trash_reports 
      WHERE latitude BETWEEN 46.0 AND 46.1 AND longitude BETWEEN 14.4 AND 14.6
    `);

    const [pendingStats] = await pool.execute(`
      SELECT COUNT(*) as pending FROM trash_reports 
      WHERE status = 'pending' AND latitude BETWEEN 46.0 AND 46.1 AND longitude BETWEEN 14.4 AND 14.6
    `);

    const [cleanedStats] = await pool.execute(`
      SELECT COUNT(*) as cleaned FROM trash_reports 
      WHERE status = 'cleaned' AND latitude BETWEEN 46.0 AND 46.1 AND longitude BETWEEN 14.4 AND 14.6
    `);

    console.log('\n📊 Ljubljana Mock Data Statistics:');
    console.log(`Total Reports: ${totalStats[0].total}`);
    console.log(`Pending Reports: ${pendingStats[0].pending}`);
    console.log(`Cleaned Reports: ${cleanedStats[0].cleaned}`);
    console.log('\n🎯 Mock data successfully inserted for Ljubljana, Slovenia!');
    console.log('🗺️  Coordinates covered: 46.0°-46.1°N, 14.4°-14.6°E');
    
  } catch (error) {
    console.error('❌ Error inserting mock data:', error);
  }
}

// Run the script
insertLjubljanaMockData().then(() => {
  console.log('Script completed');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});