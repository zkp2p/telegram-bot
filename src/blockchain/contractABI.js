// ABI with exact event definitions from the contract (including sniper events)
const abi = [
  `event IntentSignaled(
    bytes32 indexed intentHash,
    uint256 indexed depositId,
    address indexed verifier,
    address owner,
    address to,
    uint256 amount,
    bytes32 fiatCurrency,
    uint256 conversionRate,
    uint256 timestamp
  )`,
  `event IntentFulfilled(
    bytes32 indexed intentHash,
    uint256 indexed depositId,
    address indexed verifier,
    address owner,
    address to,
    uint256 amount,
    uint256 sustainabilityFee,
    uint256 verifierFee
  )`,
  `event IntentPruned(
    bytes32 indexed intentHash,
    uint256 indexed depositId
  )`,
  `event DepositReceived(
    uint256 indexed depositId,
    address indexed depositor,  
    address indexed token,
    uint256 amount,
    tuple(uint256,uint256) intentAmountRange
  )`,
  `event DepositCurrencyAdded(
    uint256 indexed depositId,
    address indexed verifier,
    bytes32 indexed currency,
    uint256 conversionRate
  )`,
  `event DepositVerifierAdded(
    uint256 indexed depositId,
    address indexed verifier,
    bytes32 indexed payeeDetailsHash,
    address intentGatingService
  )`,
  `event DepositWithdrawn(
    uint256 indexed depositId,
    address indexed depositor,
    uint256 amount
  )`,
  `event DepositClosed(
    uint256 depositId,
    address depositor
  )`,
  `event DepositCurrencyRateUpdated(
    uint256 indexed depositId,
    address indexed verifier,
    bytes32 indexed currency,
    uint256 conversionRate
  )`,
  `event BeforeExecution()`,
  `event UserOperationEvent(
    bytes32 indexed userOpHash,
    address indexed sender,
    address indexed paymaster,
    uint256 nonce,
    bool success,
    uint256 actualGasCost,
    uint256 actualGasUsed
)`,
  `event DepositConversionRateUpdated(
  uint256 indexed depositId,
  address indexed verifier,
  bytes32 indexed currency,
  uint256 newConversionRate
)`
];

module.exports = abi;