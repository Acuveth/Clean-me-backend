const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Alternative URLs for the missing images
const missingImages = [
  {
    url: 'https://images.unsplash.com/photo-1609609830354-8f615d61b9c8?w=800&q=80', // Metal cans alternative
    filename: 'trash5.jpg'
  },
  {
    url: 'https://images.unsplash.com/photo-1621451537084-482c73073a0f?w=800&q=80', // Organic waste alternative
    filename: 'trash7.jpg'
  },
  {
    url: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=800&q=80', // Tourist waste alternative
    filename: 'trash10.jpg'
  },
  {
    url: 'https://images.unsplash.com/photo-1584466977773-e625c37cdd50?w=800&q=80', // Residential waste alternative
    filename: 'trash13.jpg'
  },
  {
    url: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&q=80', // Cleaned area alternative
    filename: 'cleaned1.jpg'
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

async function main() {
  console.log('🔧 Downloading missing trash images...\n');

  const uploadsDir = path.join(__dirname, '..', 'uploads', 'trash-reports');

  let successCount = 0;
  let failCount = 0;

  for (const image of missingImages) {
    const filepath = path.join(uploadsDir, image.filename);

    const success = await downloadImage(image.url, filepath);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Add delay to avoid rate limiting
    if (missingImages.indexOf(image) < missingImages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n📊 Download Summary:`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📁 Total: ${missingImages.length}\n`);

  if (successCount > 0) {
    console.log('🎉 Missing images downloaded successfully!');
  }

  process.exit(0);
}

main();
