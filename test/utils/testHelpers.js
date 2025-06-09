const path = require('path');

const createTestPDF = (content = 'Sample PDF content') => {
    return Buffer.from(`%PDF-1.7
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Contents 4 0 R
>>
endobj
4 0 obj
<< /Length ${content.length} >>
stream
${content}
endstream
endobj
xref
trailer
<<
/Root 1 0 R
>>
%%EOF`);
};

const getFixturePath = (filename) => 
    path.join(__dirname, '../fixtures', filename);

module.exports = {
    createTestPDF,
    getFixturePath
};