// test-api.js
require('dotenv').config();
const crypto = require('crypto');
const EC = require('elliptic').ec;

// Create EC instance
const ec = new EC('secp256k1');

const PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error('❌ BACKEND_PRIVATE_KEY not found in environment variables');
  process.exit(1);
}

async function callBotAPI(method, path, body = null) {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  
  // Create the message to sign
  const message = JSON.stringify({
    method: method,
    path: path,
    body: body,
    timestamp: timestamp,
    nonce: nonce
  });
  
  console.log(' Message to sign:', message);
  
  // Hash the message
  const messageHash = crypto.createHash('sha256').update(message).digest('hex');
  console.log('🔐 Message hash:', messageHash);
  
  // Create key pair from private key
  const keyPair = ec.keyFromPrivate(PRIVATE_KEY, 'hex');
  
  // Sign the hash
  const signature = keyPair.sign(messageHash, 'hex');
  const signatureHex = signature.r.toString('hex') + signature.s.toString('hex');
  console.log('✍️ Signature:', signatureHex);
  
  // Make the request
  const response = await fetch(`http://localhost:3001${path}`, {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'x-signature': signatureHex,
      'x-timestamp': timestamp,
      'x-nonce': nonce
    },
    body: body ? JSON.stringify(body) : undefined
  });
  
  const result = await response.json();
  console.log(`📡 ${method} ${path} - Status: ${response.status}`);
  console.log(' Response:', result);
  
  return result;
}

// Test functions
async function testAddContract() {
  console.log('\n🧪 Testing ADD contract...');
  await callBotAPI('POST', '/api/samba-contracts', {
    contractAddress: '0x1234567890123456789012345678901234567890',
    contractName: 'Test Samba Contract'
  });
}

async function testGetContracts() {
  console.log('\n🧪 Testing GET contracts...');
  await callBotAPI('GET', '/api/samba-contracts');
}

async function testRemoveContract() {
  console.log('\n🧪 Testing REMOVE contract...');
  await callBotAPI('DELETE', '/api/samba-contracts/0x1234567890123456789012345678901234567890');
}

// Main test function
async function runTests() {
  try {
    console.log(' Starting API tests...');
    
    await testAddContract();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testGetContracts();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testRemoveContract();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testGetContracts();
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

runTests();