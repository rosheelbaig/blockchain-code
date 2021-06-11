pragma solidity ^0.6.0;
/**
 * @title Counters
 * @author Matt Condon (@shrugs)
 * @dev Provides counters that can only be incremented or decremented by one. This can be used e.g. to track the number
 * of elements in a mapping, issuing ERC721 ids, or counting request ids.
 *
 * Include with `using Counters for Counters.Counter;`
 * Since it is not possible to overflow a 256 bit integer with increments of one, `increment` can skip the {SafeMath}
 * overflow check, thereby saving gas. This does assume however correct usage, in that the underlying `_value` is never
 * directly accessed.
 */
library Counters {
    using SafeMath for uint256;
    struct Counter {
        // This variable should never be directly accessed by users of the library: interactions must be restricted to
        // the library's function. As of Solidity v0.5.2, this cannot be enforced, though there is a proposal to add
        // this feature: see https://github.com/ethereum/solidity/issues/4637
        uint256 _value; // default: 0
    }
    function current(Counter storage counter) internal view returns (uint256) {
        return counter._value;
    }
    function increment(Counter storage counter) internal {
        // The {SafeMath} overflow check can be skipped here, see the comment at the top
        counter._value += 1;
    }
    function decrement(Counter storage counter) internal {
        counter._value = counter._value.sub(1);
    }
}
/**
 * @dev Collection of functions related to the address type
 */
library Address {
    /**
     * @dev Returns true if `account` is a contract.
     *
     * [IMPORTANT]
     * ====
     * It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     *
     * Among others, `isContract` will return false for the following 
     * types of addresses:
     *
     *  - an externally-owned account
     *  - a contract in construction
     *  - an address where a contract will be created
     *  - an address where a contract lived, but was destroyed
     * ====
     */
    function isContract(address account) internal view returns (bool) {
        // According to EIP-1052, 0x0 is the value returned for not-yet created accounts
        // and 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470 is returned
        // for accounts without code, i.e. `keccak256('')`
        bytes32 codehash;
        bytes32 accountHash = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;
        // solhint-disable-next-line no-inline-assembly
        assembly { codehash := extcodehash(account) }
        return (codehash != accountHash && codehash != 0x0);
    }
    /**
     * @dev Converts an `address` into `address payable`. Note that this is
     * simply a type cast: the actual underlying value is not changed.
     *
     * _Available since v2.4.0._
     */
    function toPayable(address account) internal pure returns (address payable) {
        return address(uint160(account));
    }
    /**
     * @dev Replacement for Solidity's `transfer`: sends `amount` wei to
     * `recipient`, forwarding all available gas and reverting on errors.
     *
     * https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
     * of certain opcodes, possibly making contracts go over the 2300 gas limit
     * imposed by `transfer`, making them unable to receive funds via
     * `transfer`. {sendValue} removes this limitation.
     *
     * https://diligence.consensys.net/posts/2019/09/stop-using-soliditys-transfer-now/[Learn more].
     *
     * IMPORTANT: because control is transferred to `recipient`, care must be
     * taken to not create reentrancy vulnerabilities. Consider using
     * {ReentrancyGuard} or the
     * https://solidity.readthedocs.io/en/v0.5.11/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
     *
     * _Available since v2.4.0._
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");
        // solhint-disable-next-line avoid-call-value
        (bool success, ) = recipient.call.value(amount)("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }
}
/**
 * @dev Wrappers over Solidity's arithmetic operations with added overflow
 * checks.
 *
 * Arithmetic operations in Solidity wrap on overflow. This can easily result
 * in bugs, because programmers usually assume that an overflow raises an
 * error, which is the standard behavior in high level programming languages.
 * `SafeMath` restores this intuition by reverting the transaction when an
 * operation overflows.
 *
 * Using this library instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 */
library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");
        return c;
    }
    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }
    /**
     * @dev Returns the subtraction of two unsigned integers, reverting with custom message on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     * - Subtraction cannot overflow.
     *
     * _Available since v2.4.0._
     */
    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;
        return c;
    }
    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }
        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");
        return c;
    }
    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }
    /**
     * @dev Returns the integer division of two unsigned integers. Reverts with custom message on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     *
     * _Available since v2.4.0._
     */
    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        // Solidity only automatically asserts when dividing by 0
        require(b > 0, errorMessage);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return c;
    }
    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }
    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts with custom message when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     *
     * _Available since v2.4.0._
     */
    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}
pragma experimental ABIEncoderV2;
/*
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with GSN meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
contract Context {
    // Empty internal constructor, to prevent people from mistakenly deploying
    // an instance of this contract, which should be used via inheritance.
    constructor () internal { }
    // solhint-disable-previous-line no-empty-blocks
    function _msgSender() internal view returns (address payable) {
        return msg.sender;
    }
    function _msgData() internal view returns (bytes memory) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        return msg.data;
    }
}
/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
contract Ownable is Context {
    address private _owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor () internal {
        address msgSender = _msgSender();
        _owner = msgSender;
        emit OwnershipTransferred(address(0), msgSender);
    }
    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view returns (address) {
        return _owner;
    }
    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(isOwner(), "Ownable: caller is not the owner");
        _;
    }
    /**
     * @dev Returns true if the caller is the current owner.
     */
    function isOwner() public view returns (bool) {
        return _msgSender() == _owner;
    }
    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }
    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        _transferOwnership(newOwner);
    }
    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     */
    function _transferOwnership(address newOwner) internal {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}
contract TaswitContract is Ownable {
    using SafeMath for uint256;
    using Address for address;
    using Counters for Counters.Counter;
    
    struct VoteParticipants {
        uint256 userId;
        address walletAddress;
        bool isVerified;
        uint256[] participatedInEvents;
        mapping(uint256 => Counters.Counter) participatedInVoteEvents;
    }
    
    struct VoteCandidates {
        uint256 id;
        string name;
        string party;
        string biography;
        uint256 voteCount;
        bool isVerified;
        mapping(uint256 => bool) participantId;
    }
    struct VoteEvent {
        uint256 id;
        string name;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 maxParticipantVote;
        address createdBy;
        bool isActivated;
        bool isFinalized;
        mapping(address => VoteCandidates) voteCandidates;
        mapping(uint256 => Counters.Counter) voteParticipant;
        mapping(uint256 => Counters.Counter) voteEventCandidates;
    }
    
    struct VoteEventResult {
        address winnerCandidateAddress;
        uint256 totalCandidates;
        uint256 totalVotes;
        uint256 eventTotalVotes;
        bool resultStatus;
    }
    
    VoteEvent[] public voteEvent;
    
    mapping(address => VoteParticipants) voteParticipant;
    mapping(uint256 => VoteEventResult) voteEventResult;
    mapping(uint256 => bool) taswitVoteEventResults;
    mapping(address => bool) taswitParticipants;
    
    event EventVoteResult(
        uint256 eventID,
        address candidateAddress,
        uint256 totalCandidates,
        uint256 totalVotes,
        uint256 eventTotalVotes,
        bool status
    );
    
    event NewParticipant(
        uint256 participantUserId,
        address participantWalletAddress,
        bool kycStatus
    );
    
    event NewVoteEvent(
        uint256 newVoteEventID,
        string eventName,
        string eventDescription,
        uint256 eventStartTime,
        uint256 eventEndTime,
        uint256 maxParticipantVote,
        address eventCreatedBy,
        bool isActivated,
        bool isFinalized
    );
    
    event NewVoteCandidate(
        uint256 NewCandidateID,
        uint256 VoteEventID,
        string candidateName,
        string candidateParty,
        string candidateBiography,
        uint256 voteCount,
        bool isVerified
    );
    
    event ParticipateInVoteEvent(
        address participantAddress,
        uint256 eventID,
        address candidateAddress
    );
    
    event ActivateVoteEvent(uint256 eventID, bool eventStatus);
    event DeactivateVoteEvent(uint256 eventID, bool eventStatus);
    event FinalizeVoteEvent(uint256 eventID, bool finalizeStatus);
    
    /** Function - addEventVoteResult
     * @dev This function will be used to add result of event
     * @param candidateAddress - Winner Candidate Address
     * @param eventID - Event ID
     * @param totalCandidates - Total candidates participated in event
     * @param totalVotes - Total votes of candidate
     * @param eventTotalVotes - Total votes of event
     * @return response 
     */
    
    function addEventVoteResult(
        address candidateAddress,
        uint256 eventID,
        uint256 totalCandidates,
        uint256 totalVotes,
        uint256 eventTotalVotes
    ) public onlyOwner returns (bool response) {
        require(taswitVoteEventResults[eventID] == false, "Result already generated for this event");
        require(voteEvent[eventID].voteCandidates[candidateAddress].isVerified == true, "CandidateAddress is not valid");
        require(voteEvent[eventID].isFinalized == true, "Event is not finalized");
        require(voteEvent[eventID].isActivated == false, "Event is activated");
        require(voteEventResult[eventID].resultStatus == false, "Result already generated");
        taswitVoteEventResults[eventID] == true;
        voteEventResult[eventID].winnerCandidateAddress = candidateAddress;
        voteEventResult[eventID].totalCandidates = totalCandidates;
        voteEventResult[eventID].totalVotes = totalVotes;
        voteEventResult[eventID].eventTotalVotes = eventTotalVotes;
        voteEventResult[eventID].resultStatus = true;
        emit EventVoteResult(
            eventID,
            voteEventResult[eventID].winnerCandidateAddress,
            voteEventResult[eventID].totalCandidates,
            voteEventResult[eventID].totalVotes,
            voteEventResult[eventID].eventTotalVotes,
            voteEventResult[eventID].resultStatus
        );
        return true;
    }
    
    /** Function - addNewParticipant
     * @dev This function will be used to add participants 
     * @param participantUserId - Winner Candidate Address
     * @param participantWalletAddress - Total votes of candidate
     * @param kycStatus - Total votes of event
     * @return participantId
     */
    
    function addNewParticipant(
        uint256 participantUserId,
        address participantWalletAddress,
        bool kycStatus
    ) public onlyOwner returns (uint256 participantId) {
        require(
            taswitParticipants[participantWalletAddress] == false,
            "Identity already registered"
        );
        taswitParticipants[participantWalletAddress] = true;
        
        voteParticipant[participantWalletAddress].userId = participantUserId;
        voteParticipant[participantWalletAddress].walletAddress = participantWalletAddress;
        voteParticipant[participantWalletAddress].isVerified = kycStatus;
        
        emit NewParticipant(
            participantUserId,
            participantWalletAddress,
            kycStatus
        );
        return participantUserId;
    }
    
    /** Function - addNewVoteEvent
     * @dev This function will be used to add new Event 
     * @param eventName - Event Name
     * @param eventDescription - Event Desctiption
     * @param eventStartTime - Event Start Time
     * @param eventEndTime - Event End Time
     * @param maxParticipantVote - 
     * @return newEventId
     */
    
    function addNewVoteEvent(
        string memory eventName,
        string memory eventDescription,
        uint256 eventStartTime,
        uint256 eventEndTime,
        uint256 maxParticipantVote
    ) public onlyOwner returns (uint256 newEventId) {
        uint256 newVoteEventId = (voteEvent.length);
        require(
            eventStartTime < eventEndTime,
            "Event Start time should not be greater than end time"
        );
        VoteEvent memory _voteEvent = VoteEvent({
            id: newVoteEventId,
            name: eventName,
            description: eventDescription,
            startTime: eventStartTime,
            endTime: eventEndTime,
            maxParticipantVote: maxParticipantVote,
            createdBy: msg.sender,
            isActivated: false,
            isFinalized: false
        });
        voteEvent.push(_voteEvent);
        require(
            newVoteEventId == uint256(uint32(newVoteEventId)),
            "New Event ID not matched"
        );
        emit NewVoteEvent(
            newVoteEventId,
            eventName,
            eventDescription,
            eventStartTime,
            eventEndTime,
            maxParticipantVote,
            msg.sender,
            false,
            false
        );
        return newVoteEventId;
    }
    
    /** Function - addVoteCandidate
     * @dev This function will be used to add candidate in specific vote event
     * @param newCandidate - Address of new Candidate
     * @param name -  Candidate name
     * @param party - Candidate party
     * @param biography - Candidate biography
     * @param profileVerified - Candidate profile status
     * @param eventID - Event ID in which candidate will be linked
     */
    
    function addVoteCandidate(
        address newCandidate,
        string memory name,
        string memory party,
        string memory biography,
        bool profileVerified,
        uint256 eventID
    ) public onlyOwner returns (bool response) {
        require(voteEvent[eventID].startTime > now, "Event time is started");
        require(newCandidate != address(0), "Candidates cannot be empty");
        
        uint256 newCandidateID = voteEvent[eventID].voteEventCandidates[eventID].current();
        voteEvent[eventID].voteCandidates[newCandidate].id = newCandidateID;
        voteEvent[eventID].voteCandidates[newCandidate].name = name;
        voteEvent[eventID].voteCandidates[newCandidate].party = party;
        voteEvent[eventID].voteCandidates[newCandidate].biography = biography;
        voteEvent[eventID].voteCandidates[newCandidate].voteCount = 0;
        voteEvent[eventID].voteCandidates[newCandidate].isVerified = profileVerified;
        voteEvent[eventID].voteEventCandidates[eventID].increment();
        
        emit NewVoteCandidate(
            newCandidateID,
            eventID,
            name,
            party,
            biography,
            0,
            profileVerified
        );

        return true;
    }
    /** Function - getCandidateByEvent
     * @dev This function will be used to get candidate details in specific vote event
     * @param eventID - Event ID of Candidate
     * @param candidateAddress - Candidate Address
     * @return id
     * @return name
     * @return party
     * @return biography
     * @return voteCount
     */
    function getCandidateByEvent(uint256 eventID, address candidateAddress)
        public
        view
        returns (
            uint256 id,
            string memory name,
            string memory party,
            string memory biography,
            uint256 voteCount,
            bool verificationStatus
        )
    {
        return (
            voteEvent[eventID].voteCandidates[candidateAddress].id,
            voteEvent[eventID].voteCandidates[candidateAddress].name,
            voteEvent[eventID].voteCandidates[candidateAddress].party,
            voteEvent[eventID].voteCandidates[candidateAddress].biography,
            voteEvent[eventID].voteCandidates[candidateAddress].voteCount,
            voteEvent[eventID].voteCandidates[candidateAddress].isVerified
        );
    }
    /** Function - getEventResult
     * @dev This function will be used to get Event Result details of specific vote event
     * @param eventID - Event ID
     * @return candidateAddress
     * @return totalVotes
     * @return totalCandidates
     * @return resultStatus
     * @return eventTotalVotes
     */
    function getEventResult(uint256 eventID)
        public
        view
        returns (
            address candidateAddress,
            uint256 totalVotes,
            uint256 totalCandidates,
            bool resultStatus,
            uint256 eventTotalVotes
        )
    {
        return (
            voteEventResult[eventID].winnerCandidateAddress,
            voteEventResult[eventID].totalVotes,
            voteEventResult[eventID].totalCandidates,
            voteEventResult[eventID].resultStatus,
            voteEventResult[eventID].eventTotalVotes
        );
    }
    
    /** Function - participateInVoteEvent
     * @dev This function will be used to participate in vote event by participant
     * @param eventID - Event ID
     * @param candidateAddress - Candidate Address
     * @param participantAddress - participant Address
     * @return response
     */
    
    function participateInVoteEvent(
        uint256 eventID,
        address candidateAddress,
        address participantAddress
    ) public returns (bool response) {
        require(
            voteEvent[eventID].isActivated == true,
            "Event not activated yet"
        );
        require(
            voteEvent[eventID].startTime < now,
            "You cannot participate in voting, Event not started yet"
        );
        require(
            voteEvent[eventID].endTime > now,
            "You cannot participate in voting, Event is ended"
        );
        require(
            voteParticipant[participantAddress].isVerified == true,
            "Participant is not verified"
        );
        require(
            voteEvent[eventID].voteCandidates[candidateAddress].isVerified ==
                true,
            "CandidateAddress is not valid"
        );
        if (
            voteEvent[eventID].maxParticipantVote ==
            voteEvent[eventID].voteParticipant[voteParticipant[participantAddress].userId].current()
        ) {
            revert();
        } else if (
            voteEvent[eventID].maxParticipantVote > voteEvent[eventID].voteParticipant[voteParticipant[participantAddress].userId].current()
        ) {
            voteEvent[eventID].voteCandidates[candidateAddress].voteCount += 1;
            voteEvent[eventID].voteCandidates[candidateAddress].participantId[voteParticipant[participantAddress].userId] = true;
            voteEvent[eventID].voteParticipant[voteParticipant[participantAddress].userId].increment();
            voteParticipant[participantAddress].participatedInVoteEvents[eventID].increment();
            voteParticipant[participantAddress].participatedInEvents.push(eventID);
            
            emit ParticipateInVoteEvent(
                participantAddress,
                eventID,
                candidateAddress
            );
            return true;
        } else {
            revert();
        }
    }
    
    /** Function - activateVoteEvent
     * @dev This function will be used to activate Event for voting
     * @param eventID - Event ID
     * @return response
     */
    
    function activateVoteEvent(uint256 eventID)
        public
        onlyOwner
        returns (bool response)
    {
        require(voteEvent[eventID].endTime > now, "You cannot activate voting, Event time is ended");
        require(voteEvent[eventID].isActivated == false, "Event is already activated");
        voteEvent[eventID].isActivated = true;
        emit ActivateVoteEvent(eventID, voteEvent[eventID].isActivated);
        return true;
    }
    
    /** Function - deactivateVoteEvent
     * @dev This function will be used to deactivate Event for voting
     * @param eventID - Event ID
     * @return response
     */
    
    function dectivateVoteEvent(uint256 eventID)
        public
        onlyOwner
        returns (bool response)
    {
        require(
            voteEvent[eventID].endTime > now,
            "You cannot activate voting, Event time is ended"
        );
        require(
            voteEvent[eventID].isActivated == true,
            "Event is already inactivated"
        );
        voteEvent[eventID].isActivated = false;
        emit DeactivateVoteEvent(eventID, voteEvent[eventID].isActivated);
        return true;
    }
    
    /** Function - finalizeVoteEvent
     * @dev This function will be used to finalize the Event after end time to generate results 
     * @param eventID - Event ID
     * @return response
     */
    function finalizeVoteEvent(uint256 eventID)
        public
        onlyOwner
        returns (bool response)
    {
        require(
            voteEvent[eventID].endTime < now,
            "You cannot finalize voting, Event time is not ended"
        );
        require(
            voteEvent[eventID].isFinalized == false,
            "Event is already finalized"
        );
        voteEvent[eventID].isFinalized = true;
        emit FinalizeVoteEvent(eventID, voteEvent[eventID].isFinalized);
        return true;
    }
}