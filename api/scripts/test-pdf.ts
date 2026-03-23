import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main(): Promise<void> {
  const { b } = await import('../baml_client');
  const { Pdf } = await import('@boundaryml/baml');

  const pdfPath = path.join(__dirname, '..', '..', 'plan_it.pdf');
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  console.log(`Reading PDF: ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
  console.log('Extracting itinerary...\n');

  const pdf = Pdf.fromBase64(pdfBase64);
  const result = await b.ExtractItinerary(pdf);

  console.log(`Title: ${result.title}`);
  console.log(`City: ${result.city}`);
  console.log(`Dates: ${result.start_date} -> ${result.end_date}`);
  console.log(`Days: ${result.days.length}`);
  console.log(`Bookings: ${result.bookings.length}`);
  console.log(`Tips: ${result.tips.length}\n`);

  for (const day of result.days) {
    console.log(`--- Day ${day.day_number}: ${day.title} ---`);
    for (const activity of day.activities) {
      const time = activity.start_time ?? '??:??';
      const alt = activity.is_alternative ? ' [ALT]' : '';
      const price =
        activity.price_min_cents != null
          ? ` (€${(activity.price_min_cents / 100).toFixed(0)}–${((activity.price_max_cents ?? activity.price_min_cents) / 100).toFixed(0)}/pp)`
          : '';
      console.log(`  ${time} ${activity.title}${alt}${price}`);
    }
    console.log('');
  }

  // Write full JSON output
  const outPath = path.join(__dirname, '..', '..', 'kb', 'parsed-itinerary.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Full JSON written to: ${outPath}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
