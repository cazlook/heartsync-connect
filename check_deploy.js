const https = require('https');

function checkDeployment(deployId, label) {
  const query = JSON.stringify({
    query: `{ deployment(id: "${deployId}") { id status } }`
  });
  const opts = {
    hostname: 'backboard.railway.com',
    path: '/graphql/v2',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer 30438cd1-7f5f-4b65-b50f-103c6255f53c',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(query)
    }
  };
  const req = https.request(opts, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(label + ':', data);
    });
  });
  req.write(query);
  req.end();
}

checkDeployment('0f8083eb-39bf-4b5a-ba82-5b0a0919eac4', 'BACKEND');
