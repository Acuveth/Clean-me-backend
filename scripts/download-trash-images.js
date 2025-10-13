const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/database');

// Real trash image URLs from Unsplash and other free sources
// These are actual photos of litter and trash in various environments
const trashImages = [
  {
    url: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800&q=80', // Plastic bottles on beach
    filename: 'trash1.jpg',
    type: 'Plastic'
  },
  {
    url: 'https://images.unsplash.com/photo-1621451537084-482c73073a0f?w=800&q=80', // Cigarette butts
    filename: 'trash2.jpg',
    type: 'General'
  },
  {
    url: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=800&q=80', // Picnic waste
    filename: 'trash3.jpg',
    type: 'Mixed'
  },
  {
    url: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=800&q=80', // Plastic bags
    filename: 'trash4.jpg',
    type: 'Organic'
  },
  {
    url: 'https://images.unsplash.com/photo-1559467544-73e5d46fa7e0?w=800&q=80', // Metal cans
    filename: 'trash5.jpg',
    type: 'Metal'
  },
  {
    url: 'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?w=800&q=80', // Riverbank litter
    filename: 'trash6.jpg',
    type: 'Plastic'
  },
  {
    url: 'https://images.unsplash.com/photo-1586942137850-62d28cf1a6e3?w=800&q=80', // Organic waste
    filename: 'trash7.jpg',
    type: 'Organic'
  },
  {
    url: 'https://images.unsplash.com/photo-1604187351574-c75ca79f5807?w=800&q=80', // Coffee cups and paper
    filename: 'trash8.jpg',
    type: 'General'
  },
  {
    url: 'https://images.unsplash.com/photo-1583521214690-73421a1829a9?w=800&q=80', // Beer bottles
    filename: 'trash9.jpg',
    type: 'Mixed'
  },
  {
    url: 'https://images.unsplash.com/photo-1563654224-a810606e0d2d?w=800&q=80', // Tourist waste
    filename: 'trash10.jpg',
    type: 'Plastic'
  },
  {
    url: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&q=80', // Shopping bags
    filename: 'trash11.jpg',
    type: 'Plastic'
  },
  {
    url: 'https://images.unsplash.com/photo-1601599561213-832382fd07ba?w=800&q=80', // Hiking trail litter
    filename: 'trash12.jpg',
    type: 'Mixed'
  },
  {
    url: 'https://images.unsplash.com/photo-1606403543670-f61e0b7fe09c?w=800&q=80', // Residential waste
    filename: 'trash13.jpg',
    type: 'General'
  },
  {
    url: 'https://images.unsplash.com/photo-1607968565043-36af90dde238?w=800&q=80', // Playground litter
    filename: 'trash14.jpg',
    type: 'Plastic'
  },
  {
    url: 'https://images.unsplash.com/photo-1628863353691-0071c8c1874c?w=800&q=80', // Sports facility waste
    filename: 'trash15.jpg',
    type: 'Mixed'
  },
  {
    url: 'https://images.unsplash.com/photo-1622396430780-1e0f9a7f6c9f?w=800&q=80', // Cleaned area before
    filename: 'cleaned1.jpg',
    type: 'Plastic'
  },
  {
    url: 'https://images.unsplash.com/photo-1624213111452-35e8d3d5cc18?w=800&q=80', // Park cleanup
    filename: 'cleaned2.jpg',
    type: 'Mixed'
  }
];

async function downloadImage(url, filepath) {
  try {
    console.log(`📥 Downloading ${path.basename(filepath)}...`);
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    await fs.writeFile(filepath, response.data);
    console.log(`✅ Downloaded ${path.basename(filepath)}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to download ${path.basename(filepath)}: ${error.message}`);
    return false;
  }
}

async function downloadAllImages() {
  console.log('🚀 Starting trash image download...\n');

  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(__dirname, '..', 'uploads', 'trash-reports');
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    console.log(`✅ Upload directory ready: ${uploadsDir}\n`);
  } catch (error) {
    console.error(`❌ Failed to create upload directory: ${error.message}`);
    return;
  }

  let successCount = 0;
  let failCount = 0;

  // Download all images with delay to avoid rate limiting
  for (const image of trashImages) {
    const filepath = path.join(uploadsDir, image.filename);

    // Check if file already exists
    try {
      await fs.access(filepath);
      console.log(`⏭️  Skipping ${image.filename} (already exists)`);
      successCount++;
      continue;
    } catch {
      // File doesn't exist, proceed with download
    }

    const success = await downloadImage(image.url, filepath);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Add delay to avoid rate limiting (1 second between requests)
    if (trashImages.indexOf(image) < trashImages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n📊 Download Summary:`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📁 Total: ${trashImages.length}`);

  return successCount > 0;
}

async function updateDatabaseWithImages() {
  console.log('\n🔄 Updating database with real image paths...\n');

  try {
    // Update trash reports with new image paths
    const updates = [
      // Pending reports
      { oldPath: '/mock/trash1.jpg', newPath: '/uploads/trash-reports/trash1.jpg' },
      { oldPath: '/mock/trash2.jpg', newPath: '/uploads/trash-reports/trash2.jpg' },
      { oldPath: '/mock/trash3.jpg', newPath: '/uploads/trash-reports/trash3.jpg' },
      { oldPath: '/mock/trash4.jpg', newPath: '/uploads/trash-reports/trash4.jpg' },
      { oldPath: '/mock/trash5.jpg', newPath: '/uploads/trash-reports/trash5.jpg' },
      { oldPath: '/mock/trash6.jpg', newPath: '/uploads/trash-reports/trash6.jpg' },
      { oldPath: '/mock/trash7.jpg', newPath: '/uploads/trash-reports/trash7.jpg' },
      { oldPath: '/mock/trash8.jpg', newPath: '/uploads/trash-reports/trash8.jpg' },
      { oldPath: '/mock/trash9.jpg', newPath: '/uploads/trash-reports/trash9.jpg' },
      { oldPath: '/mock/trash10.jpg', newPath: '/uploads/trash-reports/trash10.jpg' },
      { oldPath: '/mock/trash11.jpg', newPath: '/uploads/trash-reports/trash11.jpg' },
      { oldPath: '/mock/trash12.jpg', newPath: '/uploads/trash-reports/trash12.jpg' },
      { oldPath: '/mock/trash13.jpg', newPath: '/uploads/trash-reports/trash13.jpg' },
      { oldPath: '/mock/trash14.jpg', newPath: '/uploads/trash-reports/trash14.jpg' },
      { oldPath: '/mock/trash15.jpg', newPath: '/uploads/trash-reports/trash15.jpg' },
      // Cleaned reports
      { oldPath: '/mock/cleaned1.jpg', newPath: '/uploads/trash-reports/cleaned1.jpg' },
      { oldPath: '/mock/cleaned2.jpg', newPath: '/uploads/trash-reports/cleaned2.jpg' }
    ];

    let updateCount = 0;
    for (const update of updates) {
      const [result] = await pool.execute(
        'UPDATE trash_reports SET photo_url = ? WHERE photo_url = ?',
        [update.newPath, update.oldPath]
      );

      if (result.affectedRows > 0) {
        console.log(`✅ Updated ${result.affectedRows} record(s): ${update.oldPath} → ${update.newPath}`);
        updateCount += result.affectedRows;
      }
    }

    console.log(`\n📊 Database Update Summary:`);
    console.log(`✅ Total records updated: ${updateCount}`);

    // Show sample of updated records
    const [samples] = await pool.execute(
      'SELECT id, photo_url, trash_type, status FROM trash_reports WHERE photo_url LIKE "/uploads/%" LIMIT 5'
    );

    if (samples.length > 0) {
      console.log(`\n📋 Sample updated records:`);
      samples.forEach(record => {
        console.log(`   ID ${record.id}: ${record.photo_url} (${record.trash_type}, ${record.status})`);
      });
    }

  } catch (error) {
    console.error('❌ Error updating database:', error);
    throw error;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Trash Clean - Real Image Downloader & Database Updater');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Step 1: Download images
    const downloadSuccess = await downloadAllImages();

    if (!downloadSuccess) {
      console.log('\n⚠️  No images were downloaded successfully. Skipping database update.');
      return;
    }

    // Step 2: Update database
    await updateDatabaseWithImages();

    console.log('\n🎉 Process completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Restart your backend server if it\'s running');
    console.log('   2. Open your Expo app and view the trash reports');
    console.log('   3. The images should now display correctly!\n');

  } catch (error) {
    console.error('\n❌ Process failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the script
main();
