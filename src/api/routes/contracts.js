const express = require('express');
const router = express.Router();
const { verifySignature } = require('../middleware/auth');
const { validateEthereumAddress, validateEmail } = require('../../utils');

// API Routes for Samba Contracts
router.post('/add-contract', verifySignature, async (req, res) => {
  try {
    const { contract, user } = req.body;
    const { db } = require('../../database');

    if (!contract) {
      return res.status(400).json({
        error: 'Contract address was not supplied in body'
      });
    }
    if (!user) {
      return res.status(400).json({
        error: 'User email was not supplied in body'
      });
    }

    // Validate Ethereum address format
    if (!validateEthereumAddress(contract)) {
      return res.status(400).json({
        error: 'Invalid Ethereum address format'
      });
    }

    // Validate user email format
    if (!validateEmail(user)) {
      return res.status(400).json({
        error: 'Invalid user email address format'
      });
    }

    // check if contract already exists
    const existingContract = await db.isSambaContract(contract);
    if (existingContract) {
      console.log(`🔍 Samba contract already exists: ${contract}`);
      return res.status(200).json({
        success: true,
        message: 'Samba contract already exists',
      });
    }

    const success = await db.addSambaContract(contract, user);

    if (success) {
      console.log(`✅ Added samba contract: ${contract} for user ${user}`);
      res.status(201).json({
        success: true,
        message: 'Samba contract added successfully',
      });
    } else {
      res.status(500).json({
        error: 'Failed to add samba contract'
      });
    }

  } catch (error) {
    console.error('❌ API Error adding samba contract:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Commented out routes - keeping for reference
// router.delete('/samba-contracts/:contractAddress', verifySignature, async (req, res) => {
//   try {
//     const { contractAddress } = req.params;
//     const { db } = require('../../database');

//     if (!contractAddress) {
//       return res.status(400).json({
//         error: 'contractAddress is required'
//       });
//     }

//     // Validate Ethereum address format
//     if (!validateEthereumAddress(contractAddress)) {
//       return res.status(400).json({
//         error: 'Invalid Ethereum address format'
//       });
//     }

//     const success = await db.removeSambaContract(contractAddress);

//     if (success) {
//       console.log(`✅ Removed samba contract: ${contractAddress}`);
//       res.json({
//         success: true,
//         message: 'Samba contract removed successfully',
//         contractAddress: contractAddress.toLowerCase()
//       });
//     } else {
//       res.status(500).json({
//         error: 'Failed to remove samba contract'
//       });
//     }

//   } catch (error) {
//     console.error('❌ API Error removing samba contract:', error);
//     res.status(500).json({
//       error: 'Internal server error'
//     });
//   }
// });

// router.get('/samba-contracts', verifySignature, async (req, res) => {
//   try {
//     const { db } = require('../../database');
//     const contracts = await db.getSambaContracts();
//     res.json({
//       success: true,
//       contracts: contracts
//     });
//   } catch (error) {
//     console.error('❌ API Error fetching samba contracts:', error);
//     res.status(500).json({
//       error: 'Internal server error'
//     });
//   }
// });

module.exports = router;