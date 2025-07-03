const { verifyMessage } = require('ethers');
const config = require('../../config');

// Add the verifySignature function here - right after middleware, before routes
const verifySignature = async (req, res, next) => {
  try {
    const signature = req.headers['x-signature'];

    console.log("AAAAAAAAAAAAAAAAAAAAAAaaReq headers", req.headers);

    if (!signature) {
      return res.status(401).json({ error: 'Missing signature headers' });
    }

    const expectedSigner = config.SAMBA_BACKEND_PUBLIC_KEY;
    
    const recoveredSigner = verifyMessage(JSON.stringify(req.body), signature);
    if (!recoveredSigner || recoveredSigner.toLowerCase() !== expectedSigner.toLowerCase()) {
      console.error('❌ Signature verification failed:', {
        expected: expectedSigner,
        recovered: recoveredSigner
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    next();

  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return res.status(500).json({ error: 'Signature verification failed' });
  }
};

module.exports = {
  verifySignature
};