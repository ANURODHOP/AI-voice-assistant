import { crawlResource } from "./crawl.js";  // Your fixed version

const PDFs = [
  "http://www.bmsce.in/sites/default/files/bmsce_good_governance_document.pdf",
  "https://bmsce.ac.in/assets/files/NACC/NACC_Cycle_3/Self%20Study%20Report-NAAC%20Cycle-III.pdf",
  "https://bmsce.ac.in/assets/files/GraduationDay/2019%20-2020%20Souvenir%20Part%201.pdf",
  "https://bmsce.ac.in/assets/img/Slider/Admission_document_and_process_flow.pdf",
  "https://www.bmsce.ac.in/assets/files/IQAC/NAAC%20CYCLE-3/1.3.3/3-EE-1.3.3/17-EE-1.3.3-PG-Project%202022-23.pdf"
];

async function testPDFs() {
  console.log("🧪 Testing 5 BMSCE PDFs...\n");
  
  for (let i = 0; i < PDFs.length; i++) {
    const url = PDFs[i];
    console.log(`[${i+1}/5] 🔍 ${url}`);
    
    try {
      const result = await crawlResource(url);
      
      if (result) {
        console.log(`✅ SUCCESS: ${result.content_type}`);
        console.log(`📏 ${result.text.length} chars`);
        console.log(`📄 Preview: ${result.text.substring(0, 200)}...\n`);
      } else {
        console.log(`❌ FAILED or filtered\n`);
      }
    } catch (error) {
      console.log(`💥 ERROR: ${error.message}\n`);
    }
    
    // Polite delay
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log("🏁 Test complete!");
}

testPDFs();
