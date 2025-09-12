const pool = require('./config/database');

async function testLjubljanaData() {
  console.log('🔍 Testing Ljubljana mock data...');
  
  try {
    // Test database connection
    const [result] = await pool.execute('SELECT COUNT(*) as total FROM trash_reports');
    console.log(`📊 Total reports in database: ${result[0].total}`);

    // Test Ljubljana area data
    const [ljubljanaReports] = await pool.execute(`
      SELECT 
        id, latitude, longitude, description, trash_type, status, points, created_at,
        location_context
      FROM trash_reports 
      WHERE latitude BETWEEN 46.0 AND 46.1 AND longitude BETWEEN 14.4 AND 14.6
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log(`\n🏙️  Ljubljana area reports: ${ljubljanaReports.length}`);
    
    if (ljubljanaReports.length > 0) {
      console.log('\n📍 Sample Ljubljana reports:');
      ljubljanaReports.forEach((report, index) => {
        console.log(`${index + 1}. [${report.status.toUpperCase()}] ${report.location_context}`);
        console.log(`   📍 ${report.latitude}, ${report.longitude}`);
        console.log(`   🗑️  ${report.trash_type} - ${report.points} points`);
        console.log(`   📝 ${report.description.substring(0, 50)}...`);
        console.log(`   ⏰ ${report.created_at}\n`);
      });
    }

    // Test pending vs cleaned
    const [statusStats] = await pool.execute(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(points) as total_points
      FROM trash_reports 
      WHERE latitude BETWEEN 46.0 AND 46.1 AND longitude BETWEEN 14.4 AND 14.6
      GROUP BY status
    `);

    console.log('📈 Status breakdown:');
    statusStats.forEach(stat => {
      console.log(`   ${stat.status}: ${stat.count} reports, ${stat.total_points || 0} points`);
    });

    // Test by area
    const [areaStats] = await pool.execute(`
      SELECT 
        location_context,
        COUNT(*) as count,
        AVG(points) as avg_points
      FROM trash_reports 
      WHERE latitude BETWEEN 46.0 AND 46.1 
        AND longitude BETWEEN 14.4 AND 14.6
        AND location_context IS NOT NULL
      GROUP BY location_context
      ORDER BY count DESC
      LIMIT 10
    `);

    console.log('\n🗺️  Top Ljubljana locations:');
    areaStats.forEach((area, index) => {
      console.log(`${index + 1}. ${area.location_context}: ${area.count} reports (avg ${Math.round(area.avg_points)} pts)`);
    });

    console.log('\n✅ Mock data test completed successfully!');
    console.log('🎯 The map should now show trash markers around Ljubljana, Slovenia');
    
  } catch (error) {
    console.error('❌ Error testing data:', error);
  }
}

// Run the test
testLjubljanaData().then(() => {
  console.log('\nTest completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});