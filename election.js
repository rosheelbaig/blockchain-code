const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodeMailer = require('nodemailer');
const DB = require('../model/db');
const Auth = require('../model/Authentication');
const Election = require('../model/Elections');
const Elections = require('../model/Elections');
const ElectionParticipation = require('../model/ElectionParticipation');
const ElectionAllocation = require('../model/ElectionAllocation');
const Users = require('../model/Users');
const ElectionCandidate = require('../model/ElectionCandidate');
const config = require('../config/configBasic');
const Validation = require('../helper/validation');
const verificationToken = require('generate-sms-verification-code');
const ServerCrypto = require('../helper/crypto');
const { check, validationResult } = require('express-validator');
const fs = require('fs');
const onChainElection = require('../accessBlockchain/electionAccessContract');
const onChainCandidateElection = require('../accessBlockchain/candidateAccessContract');
const onChainVoterElection = require('../accessBlockchain/voterAccessContract');

//create election by admin
//Admin authentication
const createElection = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    if (req.user.userType !== 'admin') {
      return res.status(403).send({
        msg: 'Only Admin can create election',
        success: false,
      });
    }
    const startDate = new Date(req.body.startDate).getTime();
    const endDate = new Date(req.body.endDate).getTime();
    if (startDate >= endDate) {
      return res.status(400).send({
        msg: 'Start Date must be greater than End Date',
        success: 'false',
      });
    } else {
      let blockchainResponse = await onChainElection.addNewElection(
        req.body.name,
        req.body.description,
        startDate,
        endDate,
        1
      );
      if (blockchainResponse.status) {
        const electionResponse = await Election.electionCreation(
          DB.pool,
          req.body.name,
          req.body.description,
          req.body.startDate,
          req.body.endDate,
          req.user.id
        );
        if (electionResponse.rowCount === 1) {
          let updateElectionOnChainResponse = await Election.updateBlockchainHashOfElection(
            DB.pool,
            blockchainResponse.response,
            electionResponse.rows[0].id
          );

          if (updateElectionOnChainResponse === 1) {
            res.status(200).send({
              msg: 'Election successfully created',
              success: true,
            });
          } else {
            res.status(200).send({
              msg:
                'Election successfully created but blockchain hash not updated',
              success: true,
            });
          }
        } else {
          res.status(400).send({
            msg: 'Election successfully created but failed on blockchain',
            success: true,
          });
        }
      } else {
        res.status(400).send({
          error: electionResponse,
          msg: 'Bad Request - Election creation failed',
          success: false,
        });
      }
    }
  } catch (e) {
    console.log(e);
    res.status(500).send({
      error: e,
      msg: 'Internal server error',
      success: false,
    });
  }
};

//Admin authentication
// Generate candidate won result, if election is completed
const generateWonResult = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    if (req.user.userType !== 'admin') {
      return res.status(403).send({
        msg: 'Only Admin can create election',
        success: false,
      });
    }

    const completedElection = await Election.getCompletedElectionById(
      DB.pool,
      req.body.id
    );
    if (completedElection.rowCount === 0) {
      return res.status(400).send({
        msg: 'Election is not completed yet',
        success: false,
      });
    }
    //Get Election Participation By election_in and joining with election_candidate and users
    const elections = await ElectionParticipation.getCandidatesIdContainingVotes(
      DB.pool,
      req.body.id
    );
    if (elections.rowCount === undefined) {
      return res.status(404).send({
        msg: 'No Election Candidates record Found',
        //candidate related to this election not found
        success: true,
      });
    } else if (elections.rowCount === 0) {
      return res.status(404).send({
        msg: 'No Election Candidates record Found',
        //candidate related to this election not found
        success: true,
      });
    }
    //set generate won to true in optimusfox_elecitons table
    const updateElection = await Elections.updateGenerateWonInElection(
      DB.pool,
      req.body.id,
      true
    );

    let arr = [];
    for (let i = 0; i < elections.rowCount; i++) {
      let tempArr = elections.rows[i].votes;
      arr.push(parseInt(tempArr));
    }
    let maxValue = Math.max(...arr);
    if (maxValue === 0) {
      return res.status(200).send({
        msg: `All candidates have 0 votes`,
        success: true,
      });
    }
    for (let i = 0; i < elections.rowCount; i++) {
      if (parseInt(elections.rows[i].votes) === maxValue && maxValue !== 0) {
        const electionCand = await ElectionCandidate.getCandidateById(
          DB.pool,
          elections.rows[i].candidate_id
        );
        if (electionCand.rowCount > 0) {
          let val = electionCand.rows[0].max_won === 0 ? 1 : 0;
          let incrementWon = electionCand.rows[0].max_won + val;
          const updateElectionCandidate = await ElectionCandidate.updateMaxWonElectionCandidate(
            DB.pool,
            elections.rows[i].candidate_id,
            incrementWon
          );
          if (updateElectionCandidate.rowCount === 1) {
            return res.status(200).send({
              msg: `${elections.rows[i].user_name} Winning Result Successfully Created`,
              success: true,
            });
          }
        }
      }
    }
  } catch (e) {
    console.log(e);
    res.status(500).send({
      error: e,
      msg: 'Internal server error',
      success: false,
    });
  }
};

//Get Election By Id
//Get All Elections
const getElectionById = async (req, res) => {
  try {
    const electionDetail = await Election.getElectionById(
      DB.pool,
      req.params.id
    );
    if (electionDetail.rowCount === 0 || electionDetail === undefined) {
      res.status(404).send({
        msg: 'No Election found',
        success: true,
      });
    }
    res.status(200).send({
      electionDetail: electionDetail.rows[0],
      msg: 'Election record found',
      success: true,
    });
  } catch (e) {
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//Get All Elections
const getAllElections = async (req, res) => {
  try {
    const elections = await Election.getAllElections(DB.pool);
    if (elections.rowCount === 0) {
      res.status(404).send({
        msg: 'No Election found',
        success: true,
      });
    }
    res.status(200).send({
      elections: elections.rows,
      msg: 'Elections record found',
      success: true,
    });
  } catch (e) {
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//update election is_active entity by admin
//admin authentication
const updateIsActiveStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    if (req.user.userType !== 'admin') {
      return res.status(401).send({
        msg: 'Only Admin can update active status',
        success: false,
      });
    }
    const electionDetails = await Election.getElectionById(
      DB.pool,
      req.body.id
    );

    if (electionDetails.rows.length === 0) {
      return res.status(400).send({
        msg: 'Election not exist',
        success: false,
      });
    }
    // if (electionDetails.rows[0].is_active === true) {
    //   return res.status(400).send({
    //     error: 'Election is already activated',
    //     success: false,
    //   });
    // }
    // const electionDetails = await Users.getUserByEmail(DB.pool, req.body.email);
    if (electionDetails.rowCount === 1) {
      let blockchainResponse = await onChainElection.activateOnChainElection(
        req.body.id
      );

      if (blockchainResponse.status) {
        let updateResponse = await Elections.updateIsActiveStatusById(
          DB.pool,
          req.body.id,
          req.body.isActive
        );
        console.log(updateResponse);
        if (updateResponse.rowCount === 1) {
          res.status(200).send({
            msg: 'Election Status updated',
            success: true,
          });
        } else {
          res.status(400).send({
            error: blockchainResponse,
            msg: 'Election Status not updated on Blockchain',
            success: false,
          });
        }
      } else {
        res.status(400).send({
          error: updateResponse,
          msg: 'Election Status not updated',
          success: false,
        });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//getElectionsDetail
const getElectionsStatsDetail = async (req, res) => {
  try {
    const electionsDetail = await Election.getElectionsStatsDetail(DB.pool);
    if (electionsDetail === undefined || electionsDetail.rowCount === 0) {
      return res.status(404).send({
        error: electionsDetail,
        msg: 'No Election record found',
        success: true,
      });
    }
    return res.status(200).send({
      electionsStats: electionsDetail.rows,
      msg: 'Elections record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//get all upcoming elections at voter/user/admin where is_active is TRUE
const getAllUpcomingElections = async (req, res) => {
  try {
    const upcomingElections = await Election.getAllUpcomingElections(DB.pool);
    if (upcomingElections.rowCount === 0) {
      return res.status(404).send({
        error: upcomingElections,
        msg: 'No Upcoming Election found',
        success: true,
      });
    }
    return res.status(200).send({
      elections: upcomingElections.rows,
      msg: 'Upcoming Elections record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//get all ongoing elections at voter/user/admin where is_active is TRUE
const getAllOngoingElections = async (req, res) => {
  try {
    const ongoingElections = await Election.getAllOngoingElections(DB.pool);
    if (ongoingElections.rowCount === 0) {
      return res.status(404).send({
        error: ongoingElections,
        msg: 'No Ongoing Election found',
        success: true,
      });
    }
    return res.status(200).send({
      elections: ongoingElections.rows,
      msg: 'Ongoing Elections record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//get all completed elections at voter/user/admin where is_active is TRUE
const getAllCompletedElections = async (req, res) => {
  try {
    const completedElections = await Election.getAllCompletedElections(DB.pool);
    if (completedElections.rowCount === 0) {
      return res.status(404).send({
        error: completedElections,
        msg: 'No Completed Election found',
        success: true,
      });
    }
    return res.status(200).send({
      elections: completedElections.rows,
      msg: 'Completed Elections record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//get all Inactive elections at voter/user/admin where is_active is FALSE
const getAllInactiveElections = async (req, res) => {
  try {
    const inactiveElections = await Election.getAllInactiveElections(DB.pool);
    if (inactiveElections.rowCount === 0) {
      return res.status(404).send({
        error: inactiveElections,
        msg: 'No Inactive Election found',
        success: true,
      });
    }
    return res.status(200).send({
      elections: inactiveElections.rows,
      msg: 'Inactive Elections record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//get ongoing election at voter/user where is_active is TRUE
const getOngoingElectionsById = async (req, res) => {
  try {
    const ongoingElection = await Election.getOngoingElectionById(
      DB.pool,
      req.params.id
    );
    if (ongoingElection.rowCount === 0) {
      return res.status(404).send({
        error: ongoingElection,
        msg: 'No Ongoing Election found',
        success: true,
      });
    }
    return res.status(200).send({
      election: ongoingElection.rows[0],
      msg: 'Ongoing Election record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//get Inactive elections at user/admin where is_active is False
const getInactiveElectionById = async (req, res) => {
  try {
    const inactiveElection = await Election.getInactiveElectionById(
      DB.pool,
      req.params.id
    );
    if (inactiveElection.rowCount === 0) {
      return res.status(404).send({
        error: inactiveElection,
        msg: 'Inactive Election not found',
        success: true,
      });
    }
    return res.status(200).send({
      election: inactiveElection.rows[0],
      msg: 'Inactive Election record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//admin authentication
// Add Election Id and User Id in Election Candidate table
const assignCandidateToElection = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    if (req.user.userType !== 'admin') {
      return res.status(401).send({
        msg: 'Only Admin can add Candidate',
        success: false,
      });
    }
    const electionDetails = await Election.getElectionById(
      DB.pool,
      req.query.electionId
    );
    const candidateDetails = await Users.getUserByIdWithoutCredential(
      DB.pool,
      req.query.id
    );
    const electionCandidateDetails = await ElectionCandidate.getElectionCandidateWithSpecificElection(
      DB.pool,
      req.query.id,
      req.query.electionId
    );

    if (electionDetails.rowsCount === 0) {
      return res.status(400).send({
        msg: 'Election not exist',
        success: false,
      });
    } else if (candidateDetails.rows.length === 0) {
      return res.status(400).send({
        msg: 'Candidate not registered Yet',
        success: false,
      });
    } else if (electionCandidateDetails.rowCount === 1) {
      return res.status(400).send({
        msg: 'Candidate already exists',
        success: false,
      });
    }

    if (electionDetails.rowCount === 1) {
      if (candidateDetails.rowCount === 1) {
        if (
          electionCandidateDetails.rowCount === 0 ||
          electionCandidateDetails === undefined
        ) {
          if (req.files) {
            const obj = JSON.parse(JSON.stringify(req.query));
            let filename = Date.now() + '-' + req.files.file.name;
            //add userid/candidateId And ElectionId to Election Candidate
            let blockchainResponse = await onChainCandidateElection.addCandidateToElection(
              candidateDetails.rows[0].id,
              candidateDetails.rows[0].name,
              obj.designation,
              obj.description,
              1,
              obj.electionId
            );
            if (blockchainResponse.status) {
              let ElectionAllocation = await Election.assignElectionCandidateToElection(
                DB.pool,
                obj.id,
                obj.electionId,
                obj.designation,
                obj.description,
                filename
              );
              if (ElectionAllocation.rowCount === 1) {
                let updateElectionOnChainResponse = await Election.updateBlockchainHashOfElectionCandidate(
                  DB.pool,
                  blockchainResponse.response,
                  candidateDetails.rows[0].id,
                  obj.electionId
                );

                if (updateElectionOnChainResponse.rowCount === 1) {
                  req.files.file.mv('./public/' + filename, (err) => {
                    if (err) {
                      filename = null;
                      return res.status(400).send({
                        error: err,
                        msg:
                          'Candidate Created but image not uploaded successfully',
                        success: false,
                      });
                    } else {
                      filename = null;
                      return res.status(200).send({
                        msg: 'Candidate created for election',
                        success: true,
                      });
                    }
                  });
                } else {
                  res.status(400).send({
                    error: updateElectionOnChainResponse,
                    msg:
                      'Bad Request - Candidate added but Blockchain status is not updated',
                    success: false,
                  });
                }
              } else {
                res.status(400).send({
                  error: updateElectionOnChainResponse,
                  msg:
                    'Bad Request - Candidate Addedbut not uploaded to Blockchain',
                  success: false,
                });
              }
            } else {
              filename = null;
              return res.status(400).send({
                error: ElectionAllocation,
                msg: 'Something is wrong - Candidate not created for election',
                success: false,
              });
            }
          } else {
            return res.status(404).send({
              msg: 'Please add an image first',
              success: false,
            });
          }
        }
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//add candidate profile image
const uploadImage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    if (req.user.userType !== 'admin') {
      return res.status(401).send({
        msg: 'Only Admin can add Candidate',
        success: false,
      });
    }

    const electionCandidateDetails = await ElectionCandidate.getElectionCandidateWithSpecificElection(
      DB.pool,
      req.params.id,
      req.params.electionId
    );
    if (
      electionCandidateDetails.rowCount === 0 ||
      electionCandidateDetails === undefined
    ) {
      return res.status(400).send({
        msg: 'Candidate not exists',
        success: false,
      });
    }
    if (electionCandidateDetails.rowCount === 1) {
      if (req.files) {
        req.files.file.mv('./public/' + filename, (err) => {
          if (err) {
            filename = null;
            return res.status(400).send({
              error: err,
              msg: 'File not uploaded, Please try again',
              success: false,
            });
          } else {
            filename = null;
            return res.status(200).send({
              msg: 'File uploaded successfully on server',
              success: true,
            });
          }
        });
      }
    }
  } catch (e) {
    console.log(e);
    res.status(500).send({
      error: e,
      msg: 'Internal server error',
      success: false,
    });
  }
};

//Add Election Id , Candidate Id and Voter/User Id in Election Participation table
const castVote = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    if (req.user.userType !== 'voter') {
      return res.status(403).send({
        msg: 'Only Voter can cast a vote',
        success: false,
      });
    } else if (req.user.isBlocked) {
      return res.status(403).send({
        msg: "Can't Vote, You are blocked by Admin",
        success: false,
      });
    }

    const completedElection = await Election.getCompletedElectionById(
      DB.pool,
      req.body.electionId
    );
    if (completedElection.rowCount === 1) {
      return res.status(400).send({
        msg: 'Election has completed',
        success: false,
      });
    }
    //     // Get election by joining election allocation table
    //     const electionDetails = await Election.getElectionWithCandidateById(
    //       DB.pool,
    //       req.body.electionId
    //     );

    //Get Election Allocation with ElectionId And ElectionCandidateId
    // const electionAllocationDetail = await ElectionAllocation.getElectionAllocationbyIds(
    //   DB.pool,
    //   req.body.candidateId,
    //   req.body.electionId
    // );

    const userDetail = await Users.getUserByIdWithoutCredential(
      DB.pool,
      req.user.id
    );

    //check if voter has already casted a vote to an election
    const electionParticipationDetails = await ElectionParticipation.getElectionParticipationByElectionAndVoterId(
      DB.pool,
      req.body.electionId,
      req.user.id
    );
    // if (electionDetails.rows.length === 0) {
    //   return res.status(400).send({
    //     error: 'Election not exist or no candidate assigned',
    //     success: false,
    //   });
    // }
    // else if (electionAllocationDetail.rowCount === 0) {
    //   return res.status(400).send({
    //     error: 'Candidates not exist for this election',
    //     success: false,
    //   });
    // }
    if (userDetail.rows[0].is_blocked) {
      return res.status(403).send({
        msg: "Can't Vote, You are blocked by Admin",
        success: false,
      });
    }
    if (electionParticipationDetails.rowCount === 1) {
      return res.status(400).send({
        msg: 'Vote already casted in this election',
        success: false,
      });
    }
    // else if (!electionDetails.rows[0].is_active) {
    //   return res.status(400).send({
    //     error: 'Election is not active yet',
    //     success: false,
    //   });
    // }

    //1 election can have multiple candidates
    // if (electionDetails.rowCount > 0) {
    // if (electionAllocationDetail.rowCount === 1) {
    if (electionParticipationDetails.rowCount === 0) {
      //add ElectionCandidateId, ElectionId and voter/user id to Election Participation
      let blockchainResponse = await onChainVoterElection.participateInOnChainVoteEvent(
        req.body.electionId,
        req.body.candidateUserId,
        req.user.id
      );
      console.log(req.body.electionId, req.body.candidateUserId, req.user.id);
      console.log(blockchainResponse);
      if (blockchainResponse.status) {
        const electionParticiation = await ElectionParticipation.castVote(
          DB.pool,
          req.body.candidateId,
          req.body.electionId,
          req.user.id
        );
        console.log(electionParticiation);
        if (electionParticiation.rowCount === 1) {
          let updateElectionOnChainResponse = await ElectionParticipation.updateBlockchainHashOfVoterParticipation(
            DB.pool,
            blockchainResponse.response,
            req.body.candidateUserId,
            req.body.electionId,
            req.user.id
          );

          console.log(updateElectionOnChainResponse);
          if (updateElectionOnChainResponse.rowCount === 1) {
            return res.status(200).send({
              msg: 'Vote has casted',
              success: true,
            });
          }
        } else {
          return res.status(400).send({
            msg: 'OnChain Vote has casted but offchain failed',
            success: true,
          });
        }
      } else {
        return res.status(400).send({
          error: electionParticiation,
          msg: 'Something is wrong - Vote has not casted',
          success: false,
        });
      }
    }
    // }
    // }
  } catch (e) {
    console.log(e);
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//getAllElectionCandidatesByElectionId with user detail
const getCandidatesByElectionId = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }

    // get all users by election id by join election_candidate table
    const electionCandidates = await Users.getAllCandidatesByElectionId(
      DB.pool,
      req.params.id
    );
    if (electionCandidates === undefined) {
      return res.status(404).send({
        msg: 'No Candidate found',
        success: true,
      });
    } else if (electionCandidates.rowCount === 0) {
      return res.status(404).send({
        msg: 'No Candidate found',
        success: true,
      });
    }
    return res.status(200).send({
      candidates: electionCandidates.rows,
      msg: 'Candidates record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//getAllElectionCandidatesByCandidateId/electionCandidateId
//need to be removed till now
// const getCandidateById = async (req, res) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ errors: errors.array(), success: false });
//     }
//     // getAllElectionCandidatesByElectionId join election allocation table and users table
//     const candidateDetail = await ElectionCandidate.getCandidatesById(
//       DB.pool,
//       req.body.candidateId
//     );
//     if (candidateDetail.rowCount === 0) {
//       res.status(404).send({
//         msg: 'No Candidate found',
//         success: true,
//       });
//     }
//     res.status(200).send({
//       candidate: candidateDetail.rows[0],
//       msg: 'Candidate record found',
//       success: true,
//     });
//   } catch (e) {
//     res.status(500).send({
//       error: e,
//       msg: 'Internal Server Error',
//       success: false,
//     });
//   }
// };

//get data by userId/voterId/candidateId from users_table for voter/candidate detail
const getUserById = async (req, res) => {
  try {
    //get data by userId/voterId/candidateId from users_table for voter/candidate detail
    const userDetail = await Users.getUserByIdWithoutCredential(
      DB.pool,
      req.params.id
    );
    if (userDetail.rowCount === 0) {
      return res.status(404).send({
        msg: 'User not found',
        success: true,
      });
    }
    return res.status(200).send({
      user: userDetail.rows[0],
      msg: 'User record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//getCandidateByCandidateId/ElectionCandidateId by joining with user table
const getCandidateById = async (req, res) => {
  try {
    // getElectionCandidateByElectionId join users table
    //getCandidateByCandidateId/ElectionCandidateId by joining with user table
    const candidateDetail = await ElectionCandidate.getCandidateById(
      DB.pool,
      req.params.id
    );
    if (candidateDetail.rowCount === 0) {
      return res.status(404).send({
        msg: 'Candidate not found',
        success: true,
      });
    }
    return res.status(200).send({
      candidate: candidateDetail.rows[0],
      msg: 'Candidate record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//get user/voter detail related to elections
const getVoterDetailById = async (req, res) => {
  try {
    const voterDetail = await Users.getVoterDetailById(DB.pool, req.params.id);
    if (voterDetail === undefined || voterDetail.rowCount === 0) {
      return res.status(404).send({
        msg: 'Voter Detail not found',
        success: true,
      });
    }
    return res.status(200).send({
      voterItem: voterDetail.rows,
      msg: 'Voter record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//get user/detail detail related to elections
const getCandidateDetailById = async (req, res) => {
  try {
    const candidateDetail = await Users.getCandidateDetailById(
      DB.pool,
      req.params.id
    );
    // console.log(candidateDetail.rows);
    if (candidateDetail === undefined || candidateDetail.rowCount === 0) {
      return res.status(404).send({
        msg: 'Candidate Detail not found',
        success: true,
      });
    }
    return res.status(200).send({
      candidateItem: candidateDetail.rows,
      msg: 'Candidate record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

const getCandidateVotersDetail = async (req, res) => {
  try {
    //Get Election Candidate Voters Details by election Id and Candidate Id
    //Get Election Specific Candidates VOters Detail
    const candidateVotersDetail = await ElectionParticipation.getCandidateVotersDetail(
      DB.pool,
      req.params.id,
      req.params.electionId
    );
    if (candidateVotersDetail.rowCount === 0) {
      return res.status(404).send({
        msg: 'Candidate Voters record not found',
        success: true,
      });
    }
    return res.status(200).send({
      candidateVoters: candidateVotersDetail.rows,
      msg: 'Candidate Voters record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//Election Stats Result
//Get electionCandidates containing how much no. of votes in specific election
const getCandidatesVotes = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    //Get Election Participation By election_in and joining with election_candidate and users
    const elections = await ElectionParticipation.getCandidatesContainingVotes(
      DB.pool,
      req.params.id
    );
    if (elections.rowCount === undefined) {
      return res.status(404).send({
        msg: 'No Election Candidates record Found',
        //candidate related to this election not found
        success: true,
      });
    } else if (elections.rowCount === 0) {
      return res.status(404).send({
        msg: 'No Election Candidates record Found',
        //candidate related to this election not found
        success: true,
      });
    }
    return res.status(200).send({
      stats: elections.rows,
      msg: 'Election Candidates record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//count total no. of votes by voter
const countTotalVotes = async (req, res) => {
  try {
    // count total votes casted by login user
    const totalVotes = await ElectionParticipation.countTotalVotesCasted(
      DB.pool,
      req.user.id
    );
    res.status(200).send({
      countVotes: totalVotes.rows[0],
      msg: 'Votes record found',
      success: true,
    });
  } catch (e) {
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//count total no. of users of type voter
const countRegisteredVoters = async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).send({
        msg: 'Not an Admin',
        success: false,
      });
    }
    // count total users where
    const totalVoters = await Users.countTotalRegisteredUsers(DB.pool, 'voter');
    res.status(200).send({
      countVoters: totalVoters.rows[0],
      msg: 'Registered Voters record found',
      success: true,
    });
  } catch (e) {
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//count total no. of users of type candidate
const countRegisteredCandidates = async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).send({
        msg: 'Not an Admin',
        success: false,
      });
    }
    // count total users where
    const totalCandidates = await Users.countTotalRegisteredUsers(
      DB.pool,
      'candidate'
    );
    return res.status(200).send({
      countCandidates: totalCandidates.rows[0],
      msg: 'Registered Candidates record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//count total no. of elections
const countTotalElections = async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).send({
        msg: 'Not an Admin',
        success: false,
      });
    }
    // count total users where
    const totalElections = await Election.countTotalElections(DB.pool);
    res.status(200).send({
      countElections: totalElections.rows[0],
      msg: 'Elections record found',
      success: true,
    });
  } catch (e) {
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//count total no. of Active Elections on Platform
const totalActiveElection = async (req, res) => {
  try {
    // count total votes casted by login user
    const totalElections = await Election.countTotalActiveElection(DB.pool);
    res.status(200).send({
      countElections: totalElections.rows[0],
      msg: 'Elections record found',
      success: true,
    });
  } catch (e) {
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//count total no. of Active Elections on Platform
const totalOngoingElections = async (req, res) => {
  try {
    // count total votes casted by login user
    const ongoingElections = await Election.countTotalOngoingElection(DB.pool);
    res.status(200).send({
      countOngoing: ongoingElections.rows[0],
      msg: 'Ongoing Elections record found',
      success: true,
    });
  } catch (e) {
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//count total no. of Active Elections on Platform
const getVotersDetail = async (req, res) => {
  try {
    // get election participation by election id and joining with users , election_candaidte, users
    const votersDetail = await ElectionParticipation.getVotersDetail(
      DB.pool,
      req.params.id
    );
    if (votersDetail.rowCount === undefined || votersDetail.rowCount === 0) {
      return res.status(404).send({
        msg: 'No Voters record Found',
        //candidate related to this election not found
        success: true,
      });
    }
    res.status(200).send({
      voters: votersDetail.rows,
      msg: 'Voters record found',
      success: true,
    });
  } catch (e) {
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//candidate Login
//Count total no. of participations in all elections by login user/candidate
const countCandidateElections = async (req, res) => {
  try {
    // count total elections Participated by login user
    //Count total no. of Candidates by login user/candidate Id in all elections
    const totalElectionsParticipation = await ElectionCandidate.countCandidateParticiatedInElections(
      DB.pool,
      req.user.id
    );
    res.status(200).send({
      countParticipations: totalElectionsParticipation.rows[0],
      msg: 'Votes record found',
      success: true,
    });
  } catch (e) {
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//candidate Login
//Count total no. of votes, casted to candidate by login user/candidate
const countCandidateVoters = async (req, res) => {
  try {
    //Count total no. of Election Candidates by login user/candidate Id join with election Participation
    const totalVotes = await ElectionCandidate.countCandidateVoters(
      DB.pool,
      req.user.id
    );
    res.status(200).send({
      countVotes: totalVotes.rows[0],
      msg: 'Votes record found',
      success: true,
    });
  } catch (e) {
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

const countCandidateWon = async (req, res) => {
  try {
    //get user join with election candidate where max_won = 1
    const totalWon = await Users.countMaxWon(DB.pool, req.user.id);
    // console.log(totalWon.rowCount);
    res.status(200).send({
      countWon: totalWon.rows[0],
      msg: 'Winning record found',
      success: true,
    });
  } catch (e) {
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//Get elections containing how much no. of votes for specific candidate
const getCandidatesElectionsVotes = async (req, res) => {
  try {
    //Get Election Participation By election_in and joining with election_candidate and users
    const elections = await ElectionCandidate.getElectionsContainingVotes(
      DB.pool,
      req.user.id
    );
    if (elections.rowCount === undefined) {
      return res.status(404).send({
        msg: 'No Elections record Found',
        //candidate related to this election not found
        success: true,
      });
    } else if (elections.rowCount === 0) {
      return res.status(404).send({
        msg: 'No Election record Found',
        //candidate related to this election not found
        success: true,
      });
    }
    return res.status(200).send({
      stats: elections.rows,
      msg: 'Elections record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//admin auth
//get all users/voters at admin side
const getAllVoters = async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(401).send({
        msg: 'You are not an admin',
        success: false,
      });
    }
    const VotersDetail = await Users.getAllVoters(DB.pool);
    if (VotersDetail.rowCount === 0) {
      return res.status(404).send({
        error: VotersDetail,
        msg: 'No Voter found',
        success: true,
      });
    }
    return res.status(200).send({
      allVoters: VotersDetail.rows,
      msg: 'Voters record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//admin auth
//get all users/candidates at admin side
const getAllCandidates = async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(401).send({
        msg: 'You are not an admin',
        success: false,
      });
    }
    const CandidateDetail = await Users.getAllCandidates(DB.pool);
    if (CandidateDetail.rowCount === 0) {
      return res.status(404).send({
        msg: 'No Candidate found',
        success: true,
      });
    }
    return res.status(200).send({
      allCandidates: CandidateDetail.rows,
      msg: 'Candidates record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//admin auth
//get all unblock users/candidates at admin side/ (under construction) where election_id is not available/found
const getAllUnlockCandidates = async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(401).send({
        msg: 'You are not an admin',
        success: false,
      });
    }
    // get all unblock candidates where isVerified is true/ (under construction) where election_is is not available/found
    const UnblockCandidatesDetail = await Users.getAllUnblockCandidates(
      DB.pool,
      req.params.id
    );
    if (UnblockCandidatesDetail.rowCount === 0) {
      return res.status(404).send({
        msg: 'No Candidate found',
        success: true,
      });
    }
    return res.status(200).send({
      unblockCandidates: UnblockCandidatesDetail.rows,
      msg: 'Unblock Candidates record found',
      success: true,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//admin authentication
//update User Block Status by admin
const updateBlockStatus = async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).send({
        msg: 'Only Admin can update block status',
        success: false,
      });
    }
    const userDetailAdminSide = await Users.getUserByIdWithoutCredential(
      DB.pool,
      req.body.id
    );
    if (userDetailAdminSide.rowCount === 0) {
      return res.status(400).send({
        msg: 'User not exist',
        success: false,
      });
    }
    if (userDetailAdminSide.rowCount === 1) {
      const updateBlockResponse = await Users.updateBlockStatusByID(
        DB.pool,
        req.body.id,
        req.body.isBlocked
      );
      if (updateBlockResponse.rowCount === 1) {
        res.status(200).send({
          msg: 'User Status updated',
          success: true,
        });
      } else {
        res.status(400).send({
          error: updateBlockResponse,
          msg: 'User Status not updated',
          success: false,
        });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

module.exports = {
  createElection,
  generateWonResult,
  getElectionById,
  getAllElections,
  updateIsActiveStatus,
  getElectionsStatsDetail,
  getAllUpcomingElections,
  getAllOngoingElections,
  getAllCompletedElections,
  getAllInactiveElections,
  getOngoingElectionsById,
  getInactiveElectionById,
  assignCandidateToElection,
  uploadImage,
  castVote,
  getCandidatesByElectionId,
  getCandidateById,
  getUserById,
  getVoterDetailById,
  getCandidateDetailById,
  getCandidateVotersDetail,
  getCandidatesVotes,
  countTotalVotes,
  totalActiveElection,
  totalOngoingElections,
  getVotersDetail,
  countCandidateElections,
  countCandidateVoters,
  countCandidateWon,
  getCandidatesElectionsVotes,
  getAllVoters,
  getAllCandidates,
  getAllUnlockCandidates,
  updateBlockStatus,
  countRegisteredVoters,
  countRegisteredCandidates,
  countTotalElections,
};
