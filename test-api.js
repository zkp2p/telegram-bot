// test-api.js
require('dotenv').config();
const { Wallet, ethers } = require('ethers');

const signer = new Wallet(process.env.TEST_SAMBA_BACKEND_PRIVATE_KEY);

async function callBotAPI(
  contract,
  user
) {
  
  // Create the message to sign
  const message = { contract, user }
  
  // Sign the message
  const signature = await signer.signMessage(JSON.stringify(message));

  // Make the request
  const response = await fetch(`http://localhost:3001/api/add-contract`, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
    },
    body: JSON.stringify(message)
  });
  
  const result = await response.json();
  console.log(`📡Status: ${response.status}`);
  console.log(' Response:', result);
  
  return result;
}

// Test functions
// async function testAddContract() {
//   console.log('\n🧪 Testing ADD contract...');
//   await callBotAPI('POST', '/api/samba-contracts', {
//     contractAddress: '0x1234567890123456789012345678901234567890',
//     user: 'clinton@whitehouse.gov'
//   });
// }

// async function testGetContracts() {
//   console.log('\n🧪 Testing GET contracts...');
//   await callBotAPI('GET', '/api/samba-contracts');
// }

// async function testRemoveContract() {
//   console.log('\n🧪 Testing REMOVE contract...');
//   await callBotAPI('DELETE', '/api/samba-contracts/0x1234567890123456789012345678901234567890');
// }

// Main test function
async function runTests() {
  try {
    console.log(' Starting API tests...');
    
    await callBotAPI(
      "0x1234567890123456789012345678901234567890",
      "clinton@whitehouse.gov"
    )
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

runTests();