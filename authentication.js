const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodeMailer = require('nodemailer');
const DB = require('../model/db');
const Auth = require('../model/Authentication');
const Users = require('../model/Users');
const config = require('../config/configBasic');
const fs = require('fs');
const Validation = require('../helper/validation');
const verificationToken = require('generate-sms-verification-code');
const ServerCrypto = require('../helper/crypto');
const { check, validationResult } = require('express-validator');
const { isEmpty } = require('../helper/uploadfile-helper');
const userBlockchainWallet = require('../accessBlockchain/userWallet');
const onChainUser = require('../accessBlockchain/voterAccessContract');

//Get Logged In Voter Data or Logged In candidate data or Logged In Admin Data without users_credentials
const getLoggedInUser = async (req, res) => {
  try {
    const loggedInUser = await Users.getLoggedInUserById(DB.pool, req.user.id);

    res.status(200).send({
      user: loggedInUser.rows[0],
      msg: 'User Data Found',
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

//voter registration
const userRegister = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }

    ////////////////
    this.sendEmailFunc = function (newVerificationToken) {
      const output = `Hi ${req.body.userName},<br/> Thanks for contacting to our support! <br/><br/> Your verification code is ${newVerificationToken} <br/><br/>`;
      let transporter = nodeMailer.createTransport({
        host: config.mailTrap.hostname,
        port: config.mailTrap.port,
        secure: config.mailTrap.secure,
        auth: {
          user: config.mailTrap.auth.username,
          pass: config.mailTrap.auth.password,
        },
        tls: {
          rejectUnauthorized: config.mailTrap.tls.rejectUnauthorized,
        },
      });
      let mailOptions = {
        from: config.mailTrap.fromEmail,
        to: req.body.email,
        subject: `Thank you for register`,
        text: `Account Details for the new user Email ${req.body.email}`, // plain text body
        html: output,
      };
      transporter.sendMail(mailOptions, async (error, info) => {
        if (error) {
          return res.status(400).send({
            msg: 'Facing problem to send email - Check internet connection',
            success: false,
          });
        } else {
          return res.status(200).send({
            msg: 'Email sent Successfully. To Login, Please verify your email',
            success: true,
          });
        }
      });
    };
    ///////////////

    const userDetail = await Users.getUserByUsername(
      DB.pool,
      req.body.userName
    );
    if (
      userDetail &&
      userDetail.rows &&
      userDetail.rows.length > 0 &&
      userDetail.rows[0].user_name
    ) {
      return res.status(400).send({
        msg: 'Username already exist',
        success: false,
      });
    }

    const user = await Users.getGeneralUserByEmail(DB.pool, req.body.email);
    if (user && user.rows && user.rows.length > 0) {
      return res.status(400).send({
        msg: 'Email already exist',
        success: false,
      });
    }

    const encryptedPassword = await bcrypt.hash(
      req.body.password,
      config.jwt.saltRounds
    );

    let newVerificationToken = verificationToken(config.verificationTokenSize, {
      type: 'number',
    });
    let encryptedToken = await ServerCrypto.serverEncryption(
      newVerificationToken
    );

    //update user record
    //if user is not verified, but exists then update existing user record with new record
    if (
      user &&
      user.rows &&
      user.rows.length > 0 &&
      user.rows[0].is_verified === false
    ) {
      const updateRegisterResponse = await Auth.updateUserRegistration(
        DB.pool,
        req.body.userName,
        req.body.name,
        req.body.email,
        req.body.phone,
        req.body.city,
        req.body.country,
        req.body.address
      );
      if (updateRegisterResponse.rowCount === 1) {
        const updateCredentialsResponse = await Auth.updateUserCredentials(
          DB.pool,
          encryptedPassword,
          encryptedToken,
          user.rows[0].user_id
        );
        if (updateCredentialsResponse.rowCount === 1) {
          this.sendEmailFunc(newVerificationToken);
        } else {
          return res.status(400).send({
            error: updateCredentialsResponse,
            msg: 'Bad Request - Registration credentials failed',
            success: false,
          });
        }
      } else {
        return res.status(400).send({
          error: updateRegisterResponse,
          msg: 'Bad Request - Registration failed',
          success: false,
        });
      }
    } else {
      //update user record
      //if user not exists
      const registerResponse = await Auth.userRegistration(
        DB.pool,
        req.body.userName,
        req.body.name,
        req.body.email,
        req.body.phone,
        req.body.city,
        req.body.country,
        req.body.address,
        'voter'
      );
      if (registerResponse.rowCount === 1) {
        const credentialsResponse = await Auth.userCredentials(
          DB.pool,
          encryptedPassword,
          encryptedToken,
          registerResponse.rows[0].id
        );
        if (credentialsResponse.rowCount === 1) {
          this.sendEmailFunc(newVerificationToken);
        } else {
          return res.status(400).send({
            error: credentialsResponse,
            msg: 'Bad Request - Registration credentials failed',
            success: false,
          });
        }
      } else {
        return res.status(400).send({
          error: registerResponse,
          msg: 'Bad Request - Registration failed',
          success: false,
        });
      }
    }
  } catch (e) {
    console.log(e);
    return res.status(500).send({
      error: e,
      msg: 'Internal server error',
      success: false,
    });
  }
};

//verify voter-registration by verification_token after registeration
const verifyUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    const response = await Users.getUserByEmail(DB.pool, req.body.email);

    if (response.rowCount === 0) {
      return res.status(404).send({
        msg: 'Invalid Email. User not exist.',
        success: false,
      });
    } else if (response.rows[0].verification_token === 'undefined') {
      return res.status(401).send({
        msg: 'Invalid Token.',
        success: false,
      });
    }
    let decryptedToken = await ServerCrypto.serverDecryption(
      response.rows[0].verification_token
    );
    //here was written query but verificationToken will get from req.body
    if (decryptedToken === req.body.verificationToken) {
      const userResponse = await Users.updateUserVerificationStatus(
        DB.pool,
        response.rows[0].email
      );
      const userTokenResponse = await Users.updateUserVerificationToken(
        DB.pool,
        response.rows[0].user_id
      );
      if (userResponse.rowCount === 1 && userTokenResponse.rowCount === 1) {
        let newUserWallet = await userBlockchainWallet.createNewWallet();
        let responseWallet = await Users.addUserWallet(
          DB.pool,
          response.rows[0].user_id,
          newUserWallet
        );
        if (responseWallet.rowCount === 1) {
          let blockchainResponse = await onChainUser.addVoterToContract(
            response.rows[0].user_id
          );

          if (blockchainResponse.status) {
            let updateElectionOnChainResponse = await Users.updateBlockchainHashOfUser(
              DB.pool,
              blockchainResponse.response,
              response.rows[0].user_id
            );

            if (updateElectionOnChainResponse.rowCount === 1) {
              return res.status(200).send({
                msg: 'Your account has been verified and wallet created',
                success: true,
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
          return res.status(400).send({
            msg: 'Your account has not been verified',
            success: false,
          });
        }
      } else {
        return res.status(400).send({
          error: userResponse,
          msg: 'Your account has not been verified',
          success: false,
        });
      }
    } else {
      return res.status(401).send({
        msg: 'Unauthorized Token',
        success: false,
      });
    }
  } catch (e) {
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//voter login
const userLogin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    const users = await Auth.userLogin(DB.pool, req.body.email);
    if (users.rows.length === 0) {
      return res.status(404).send({
        msg: 'Email not exists',
        success: false,
      });
    } else if (users.rows[0].is_verified === false) {
      return res.status(401).send({
        msg: 'Your account is not verified',
        success: false,
      });
    } else if (users.rows[0].is_blocked === true) {
      return res.status(401).send({
        msg: 'Your account is blocked by Admin',
        success: false,
      });
    }
    bcrypt.compare(
      req.body.password,
      users.rows[0].password,
      function (err, response) {
        if (response)
          res.status(200).send({
            userDetail: {
              id: users.rows[0].id,
              userId: users.rows[0].user_id,
              username: users.rows[0].user_name,
              name: users.rows[0].name,
              address: users.rows[0].address,
              city: users.rows[0].city,
              country: users.rows[0].country,
              phone: users.rows[0].phone,
              email: users.rows[0].email,
              isBlocked: users.rows[0].is_blocked,
              userType: users.rows[0].user_type,
              isVerified: users.rows[0].is_verified,
              createdAt: users.rows[0].created_at,
            },
            token: jwt.sign(
              {
                id: users.rows[0].user_id,
                email: users.rows[0].email,
                userType: users.rows[0].user_type,
                isBlocked: users.rows[0].is_blocked,
              },
              config.jwt.secret
            ),
            success: true,
          });
        else
          res.status(401).send({
            error: err,
            msg: 'Password is incorrect',
            success: false,
          });
      }
    );
  } catch (e) {
    console.error(e);
    res.status(500).send({
      error: e,
      msg: 'Internal server error',
      success: false,
    });
  }
};

//forget password for voter
const forgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    const userDetail = await Users.getUserByEmail(DB.pool, req.body.email);

    if (userDetail.rows.length === 0) {
      return res.status(404).send({
        msg: 'Email not found',
        Success: false,
      });
    } else if (userDetail.rows[0].is_verified === false) {
      return res.status(400).send({
        msg: 'Email is not verified',
        Success: false,
      });
    }
    if (userDetail.rowCount === 1) {
      let newVerificationToken = verificationToken(
        config.verificationTokenSize,
        {
          type: 'number',
        }
      );
      let encryptedToken = await ServerCrypto.serverEncryption(
        newVerificationToken
      );
      const userResponse = await Users.updateForgotStatus(
        DB.pool,
        userDetail.rows[0].user_id,
        encryptedToken
      );
      if (userResponse.rowCount === 1) {
        const output = `Hi ${userDetail.rows[0].user_name},<br/> Thanks for contacting to our support! <br/><br/> Your verification code is ${newVerificationToken} <br/><br/>`;
        let transporter = nodeMailer.createTransport({
          host: config.mailTrap.hostname,
          port: config.mailTrap.port,
          secure: config.mailTrap.secure,
          auth: {
            user: config.mailTrap.auth.username,
            pass: config.mailTrap.auth.password,
          },
          tls: {
            rejectUnauthorized: config.mailTrap.tls.rejectUnauthorized,
          },
        });

        let mailOptions = {
          from: config.mailTrap.fromEmail,
          to: req.body.email,
          subject: `Thank you for register`,
          text: `Account Details for the new user Email ${req.body.email}`, // plain text body
          html: output,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log(error);
            res.status(400).send({
              msg: 'Facing problem to send email - Check internet connection',
              success: false,
            });
          } else {
            res.status(200).send({
              msg: 'Verification email sent to you Successfully',
              success: true,
            });
          }
        });
      }
    } else {
      res.status(404).send({
        msg: 'Email not exist in our Platform',
        success: false,
      });
    }
  } catch (e) {
    res.status(500).send({
      error: e,
      msg: 'Something went wrong - Forgot verification email failed',
      success: false,
    });
  }
};

//Verify forget password for voter
const verifyForgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    const response = await Users.getUserByEmail(DB.pool, req.body.email);
    if (response.rowCount === 0) {
      return res.status(403).send({
        msg: 'Invalid Email. User not exist.',
        success: false,
      });
    } else if (response.rows[0].token === 'undefined') {
      return res.status(403).send({
        msg: 'Invalid Token.',
        success: false,
      });
    } else if (response.rows[0].token === '') {
      return res.status(403).send({
        msg: 'Invalid Token.',
        success: false,
      });
    }

    let decryptedToken = await ServerCrypto.serverDecryption(
      response.rows[0].verification_token
    );
    //here was written query instead of body
    if (decryptedToken === req.body.verificationToken) {
      const userResponse = await Users.updateVerificationForgotStatus(
        DB.pool,
        response.rows[0].user_id,
        'verified'
      );
      if (userResponse.rowCount === 1) {
        return res.status(200).send({
          msg: 'Your account has been verified',
          success: true,
        });
      } else {
        return res.status(401).send({
          error: userResponse,
          msg: 'Your account has not been verified',
          success: false,
        });
      }
    } else {
      return res.status(401).send({
        msg: 'Unauthorized Token',
        success: false,
      });
    }
  } catch (e) {
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

// Reset/update password for voter/user
const updateUserPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    const userDetails = await Users.getUserByEmail(DB.pool, req.body.email);
    if (userDetails.rows.length === 0) {
      return res.status(400).send({
        msg: 'Email not exist',
        success: false,
      });
    }
    if (userDetails.rows[0].is_verified === false) {
      return res.status(400).send({
        msg: 'Email is not verified',
        success: false,
      });
    }
    // const userDetails = await Users.getUserByEmail(DB.pool, req.body.email);
    if (userDetails.rowCount === 1) {
      // console.log('asd',userDetails.rows[0])
      if (userDetails.rows[0].verification_token === 'verified') {
        const encryptedPassword = await bcrypt.hash(
          req.body.password,
          config.jwt.saltRounds
        );

        let passwordResponse = await Users.addNewPassword(
          DB.pool,
          userDetails.rows[0].user_id,
          encryptedPassword
        );
        let forgotResponse = await Users.updateVerificationForgotStatus(
          DB.pool,
          userDetails.rows[0].user_id,
          ''
        );

        if (forgotResponse.rowCount === 1 && passwordResponse.rowCount === 1) {
          res.status(200).send({
            msg: 'Password updated',
            success: true,
          });
        } else {
          res.status(400).send({
            error: passwordResponse,
            msg: 'Password not updated',
            success: false,
          });
        }
      } else {
        return res.status(401).send({
          msg: 'Unauthorized Token',
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

// Admin Login
const adminLogin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    const users = await Auth.adminLogin(DB.pool, req.body.email);
    if (users.rows.length === 0) {
      return res.status(400).send({
        error: users,
        msg: 'Email is wrong',
        success: false,
      });
    }
    bcrypt.compare(
      req.body.password,
      users.rows[0].password,
      function (err, response) {
        if (response)
          res.send({
            userDetail: {
              id: users.rows[0].id,
              userId: users.rows[0].user_id,
              username: users.rows[0].user_name,
              name: users.rows[0].name,
              address: users.rows[0].address,
              city: users.rows[0].city,
              country: users.rows[0].country,
              phone: users.rows[0].phone,
              email: users.rows[0].email,
              isVerified: users.rows[0].is_verified,
              createdAt: users.rows[0].created_at,
              userType: users.rows[0].user_type,
              isBlocked: users.rows[0].is_blocked,
            },
            token: jwt.sign(
              {
                id: users.rows[0].user_id,
                email: users.rows[0].email,
                userType: users.rows[0].user_type,
              },
              config.jwt.secret
            ),
            success: true,
          });
        else
          res.status(401).send({
            error: err,
            msg: 'Password is incorrect',
            success: false,
          });
      }
    );
  } catch (e) {
    console.error(e);
    res.status(500).send({
      error: e,
      msg: 'Internal server error',
      success: false,
    });
  }
};

//Candidate registration
const candidateRegister = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }

    ////////////////
    this.sendCandEmailFunc = function (newVerificationToken) {
      const output = `Hi ${req.body.userName},<br/> Thanks for contacting to our support! <br/><br/> Your verification code is ${newVerificationToken} <br/><br/>`;
      let transporter = nodeMailer.createTransport({
        host: config.mailTrap.hostname,
        port: config.mailTrap.port,
        secure: config.mailTrap.secure,
        auth: {
          user: config.mailTrap.auth.username,
          pass: config.mailTrap.auth.password,
        },
        tls: {
          rejectUnauthorized: config.mailTrap.tls.rejectUnauthorized,
        },
      });
      let mailOptions = {
        from: config.mailTrap.fromEmail,
        to: req.body.email,
        subject: `Thank you for register`,
        text: `Account Details for the new user Email ${req.body.email}`, // plain text body
        html: output,
      };
      transporter.sendMail(mailOptions, async (error, info) => {
        if (error) {
          return res.status(400).send({
            msg: 'Facing problem to send email - Check internet connection',
            success: false,
          });
        } else {
          return res.status(200).send({
            msg: 'Email sent Successfully. Please verify your account',
            success: true,
          });
        }
      });
    };
    ////////////////

    const userDetail = await Users.getUserByUsername(
      DB.pool,
      req.body.userName
    );
    if (
      userDetail &&
      userDetail.rows &&
      userDetail.rows.length > 0 &&
      userDetail.rows[0].user_name
    ) {
      return res.status(400).send({
        msg: 'Username already exist',
        success: false,
      });
    }

    const user = await Users.getGeneralUserByEmail(DB.pool, req.body.email);
    if (user && user.rows && user.rows.length > 0) {
      return res.status(400).send({
        msg: 'Email already exist',
        success: false,
      });
    }

    const encryptedPassword = await bcrypt.hash(
      req.body.password,
      config.jwt.saltRounds
    );
    const newVerificationToken = verificationToken(
      config.verificationTokenSize,
      {
        type: 'number',
      }
    );
    let encryptedToken = await ServerCrypto.serverEncryption(
      newVerificationToken
    );

    //update candidate record
    //if candidate is not verified, but exists then update existing candidate record with new record
    if (
      user &&
      user.rows &&
      user.rows.length > 0 &&
      user.rows[0].is_verified === false
    ) {
      const updateRegisterResponse = await Auth.updateUserRegistration(
        DB.pool,
        req.body.userName,
        req.body.name,
        req.body.email,
        req.body.phone,
        req.body.city,
        req.body.country,
        req.body.address
      );
      if (updateRegisterResponse.rowCount === 1) {
        const updateCredentialsResponse = await Auth.updateUserCredentials(
          DB.pool,
          encryptedPassword,
          encryptedToken,
          user.rows[0].user_id
        );
        if (updateCredentialsResponse.rowCount === 1) {
          this.sendCandEmailFunc(newVerificationToken);
        } else {
          return res.status(400).send({
            error: updateCredentialsResponse,
            msg: 'Bad Request - Registration credentials failed',
            success: false,
          });
        }
      } else {
        return res.status(400).send({
          error: updateRegisterResponse,
          msg: 'Bad Request - Registration failed',
          success: false,
        });
      }
    } else {
      //update candidate record
      //if candidate not exists
      const registerResponse = await Auth.userRegistration(
        DB.pool,
        req.body.userName,
        req.body.name,
        req.body.email,
        req.body.phone,
        req.body.city,
        req.body.country,
        req.body.address,
        'candidate'
      );

      if (registerResponse.rowCount === 1) {
        const credentialsResponse = await Auth.userCredentials(
          DB.pool,
          encryptedPassword,
          encryptedToken,
          registerResponse.rows[0].id
        );
        if (credentialsResponse.rowCount === 1) {
          this.sendCandEmailFunc(newVerificationToken);
        } else {
          return res.status(400).send({
            error: credentialsResponse,
            msg: 'Bad Request - Registration credentials failed',
            success: false,
          });
        }
      } else {
        return res.status(400).send({
          error: registerResponse,
          msg: 'Bad Request - Registration failed',
          success: false,
        });
      }
    }
  } catch (e) {
    console.log(e);
    return res.status(500).send({
      error: e,
      msg: 'Internal server error',
      success: false,
    });
  }
};

//add candidate profile image
let files = [];
const uploadImage = async (req, res) => {
  try {
    const response = await Users.getCandidateByEmail(DB.pool, req.query.email);

    if (response.rowCount === 0) {
      return res.status(403).send({
        msg: 'Invalid Email. User not exist.',
        success: false,
      });
    } else if (response.rows[0].verification_token === 'undefined') {
      return res.status(403).send({
        msg: 'Invalid Token.',
        success: false,
      });
    }
    if (!isEmpty(req.files)) {
      file = req.files.file;
      files.push(file);
      return res.json({ msg: 'Image has Uploaded', alertType: 'success' });
    }
    return res.json({ msg: 'Due to some issue, Image cannot be uploaded' });
  } catch (e) {
    console.log(e);
    res.status(500).send({
      error: e,
      msg: 'Internal server error',
      success: false,
    });
  }
};

//Add candidate Detail
const addDetail = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    const response = await Users.getCandidateByEmail(DB.pool, req.query.email);
    const canResponse = await Users.getElectionCandidateById(
      DB.pool,
      response.rows[0].user_id
    );

    if (response.rowCount === 0) {
      return res.status(403).send({
        msg: 'Invalid Email. User not exist.',
        success: false,
      });
    } else if (response.rows[0].verification_token === 'undefined') {
      return res.status(403).send({
        msg: 'Invalid Token.',
        success: false,
      });
    } else if (canResponse.rowCount > 0) {
      return res.status(403).send({
        msg: 'Candidate description already exist',
        success: false,
      });
    }
    let filename;
    if (files.length > 0) {
      files.map((file) => {
        filename = Date.now() + '-' + file.name;
        file.mv('./public/' + filename, (err) => {
          if (err) throw err;
        });
      });
    }

    const candidateResponse = await Auth.addCandidateDetail(
      DB.pool,
      response.rows[0].user_id,
      req.body.designation,
      req.body.description,
      filename
    );
    if (candidateResponse.rowCount === 1) {
      return res.status(200).send({
        msg: 'Candidate description added successfully',
        success: true,
      });
    } else {
      res.status(400).send({
        error: candidateResponse,
        msg: 'Bad Request - Registration failed',
        success: false,
      });
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

//verify candidate
const verifyCandidate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    const response = await Users.getCandidateByEmail(DB.pool, req.body.email);

    if (response.rowCount === 0) {
      return res.status(403).send({
        msg: 'Invalid Email. User not exist.',
        success: false,
      });
    } else if (response.rows[0].verification_token === 'undefined') {
      return res.status(403).send({
        msg: 'Invalid Token.',
        success: false,
      });
    }
    let decryptedToken = await ServerCrypto.serverDecryption(
      response.rows[0].verification_token
    );
    //here was written query but verificationToken will get from req.body
    if (decryptedToken === req.body.verificationToken) {
      const userResponse = await Users.updateUserVerificationStatus(
        DB.pool,
        response.rows[0].email
      );
      const userTokenResponse = await Users.updateUserVerificationToken(
        DB.pool,
        response.rows[0].user_id
      );
      if (userResponse.rowCount === 1 && userTokenResponse.rowCount === 1) {
        let newUserWallet = await userBlockchainWallet.createNewWallet();
        let responseWallet = await Users.addUserWallet(
          DB.pool,
          response.rows[0].user_id,
          newUserWallet
        );
        if (responseWallet.rowCount === 1) {
          return res.status(200).send({
            msg: 'Your account has been verified and wallet created',
            success: true,
          });
        } else {
          return res.status(400).send({
            msg: 'Your account has not been verified',
            success: false,
          });
        }
      } else {
        return res.status(401).send({
          error: userResponse,
          msg: 'Your account has not been registered',
          success: false,
        });
      }
    } else {
      return res.status(401).send({
        msg: 'Unauthorized Token',
        success: false,
      });
    }
  } catch (e) {
    console.log(e);
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

//candidate login
const candidateLogin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    const users = await Auth.candidateLogin(DB.pool, req.body.email);
    if (users.rows.length === 0) {
      return res.status(400).send({
        msg: 'Email not exists',
        success: false,
      });
    } else if (users.rows[0].is_verified === false) {
      return res.status(400).send({
        msg: 'Your account is not verified',
        success: false,
      });
    } else if (users.rows[0].is_blocked === true) {
      return res.status(401).send({
        msg: 'Your account is blocked by Admin',
        success: false,
      });
    }
    bcrypt.compare(
      req.body.password,
      users.rows[0].password,
      function (err, response) {
        if (response)
          res.status(200).send({
            userDetail: {
              id: users.rows[0].id,
              userId: users.rows[0].user_id,
              username: users.rows[0].user_name,
              name: users.rows[0].name,
              address: users.rows[0].address,
              city: users.rows[0].city,
              country: users.rows[0].country,
              phone: users.rows[0].phone,
              email: users.rows[0].email,
              userType: users.rows[0].user_type,
              isVerified: users.rows[0].is_verified,
              createdAt: users.rows[0].created_at,
            },
            token: jwt.sign(
              {
                id: users.rows[0].user_id,
                email: users.rows[0].email,
                userType: users.rows[0].user_type,
                isBlocked: users.rows[0].is_blocked,
              },
              config.jwt.secret
            ),
            success: true,
          });
        else
          res.status(401).send({
            error: err,
            msg: 'Password is incorrect',
            success: false,
          });
      }
    );
  } catch (e) {
    console.error(e);
    res.status(500).send({
      error: e,
      msg: 'Internal server error',
      success: false,
    });
  }
};

//forget password for candidate
const forgotPasswordCandidate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }

    const userDetail = await Users.getCandidateByEmail(DB.pool, req.body.email);

    if (userDetail.rows.length === 0) {
      return res.status(400).send({
        msg: 'Email not found',
        Success: false,
      });
    } else if (userDetail.rows[0].is_verified === false) {
      return res.status(400).send({
        msg: 'Email is not verified',
        Success: false,
      });
    }
    if (userDetail.rowCount === 1) {
      let newVerificationToken = verificationToken(
        config.verificationTokenSize,
        {
          type: 'number',
        }
      );
      let encryptedToken = await ServerCrypto.serverEncryption(
        newVerificationToken
      );
      const userResponse = await Users.updateForgotStatus(
        DB.pool,
        userDetail.rows[0].user_id,
        encryptedToken
      );
      if (userResponse.rowCount === 1) {
        const output = `Hi ${userDetail.rows[0].user_name},<br/> Thanks for contacting to our support! <br/><br/> Your verification code is ${newVerificationToken} <br/><br/>`;
        let transporter = nodeMailer.createTransport({
          host: config.mailTrap.hostname,
          port: config.mailTrap.port,
          secure: config.mailTrap.secure,
          auth: {
            user: config.mailTrap.auth.username,
            pass: config.mailTrap.auth.password,
          },
          tls: {
            rejectUnauthorized: config.mailTrap.tls.rejectUnauthorized,
          },
        });

        let mailOptions = {
          from: config.mailTrap.fromEmail,
          to: req.body.email,
          subject: `Thank you for register`,
          text: `Account Details for the new user Email ${req.body.email}`, // plain text body
          html: output,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log(error);
            res.status(400).send({
              msg: 'Facing problem to send email - Check internet connection',
              success: false,
            });
          } else {
            res.status(200).send({
              msg: 'Verification email sent to you Successfully',
              success: true,
            });
          }
        });
      }
    } else {
      res.status(400).send({
        msg: 'Email not exist in our Platform',
        success: false,
      });
    }
  } catch (e) {
    console.log(e);
    res.status(500).send({
      error: e,
      msg: 'Something went wrong - Forgot verification email failed',
      success: false,
    });
  }
};

//Verify forget password for candidate
const verifyForgotPasswordCandidate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    const response = await Users.getCandidateByEmail(DB.pool, req.body.email);
    if (response.rowCount === 0) {
      return res.status(403).send({
        msg: 'Invalid Email. User not exist.',
        success: false,
      });
    } else if (response.rows[0].verification_token === 'undefined') {
      return res.status(403).send({
        msg: 'Invalid Token.',
        success: false,
      });
    } else if (response.rows[0].verification_token === '') {
      return res.status(403).send({
        msg: 'Invalid Token.',
        success: false,
      });
    }

    let decryptedToken = await ServerCrypto.serverDecryption(
      response.rows[0].verification_token
    );
    //here was written query instead of body
    if (decryptedToken === req.body.verificationToken) {
      const userResponse = await Users.updateVerificationForgotStatus(
        DB.pool,
        response.rows[0].user_id,
        'verified'
      );
      if (userResponse.rowCount === 1) {
        return res.status(200).send({
          msg: 'Your account has been verified',
          success: true,
        });
      } else {
        return res.status(401).send({
          error: userResponse,
          msg: 'Your account has not been verified',
          success: false,
        });
      }
    } else {
      return res.status(401).send({
        msg: 'Unauthorized Token',
        success: false,
      });
    }
  } catch (e) {
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};

// Reset/update password for candidate
const updateCandidatePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), success: false });
    }
    const userDetails = await Users.getCandidateByEmail(
      DB.pool,
      req.body.email
    );
    if (userDetails.rows.length === 0) {
      return res.status(400).send({
        msg: 'Email not exist',
        success: false,
      });
    }
    if (userDetails.rows[0].is_verified === false) {
      return res.status(400).send({
        msg: 'Email is not verified',
        success: false,
      });
    }
    // const userDetails = await Users.getUserByEmail(DB.pool, req.body.email);
    if (userDetails.rowCount === 1) {
      if (userDetails.rows[0].verification_token === 'verified') {
        const encryptedPassword = await bcrypt.hash(
          req.body.password,
          config.jwt.saltRounds
        );

        let passwordResponse = await Users.addNewPassword(
          DB.pool,
          userDetails.rows[0].user_id,
          encryptedPassword
        );
        let forgotResponse = await Users.updateVerificationForgotStatus(
          DB.pool,
          userDetails.rows[0].user_id,
          ''
        );

        if (forgotResponse.rowCount === 1 && passwordResponse.rowCount === 1) {
          res.status(200).send({
            msg: 'Password updated',
            success: true,
          });
        } else {
          res.status(400).send({
            error: passwordResponse,
            msg: 'Password not updated',
            success: false,
          });
        }
      } else {
        return res.status(401).send({
          msg: 'Unauthorized Token',
          success: false,
        });
      }
    }
  } catch (e) {
    res.status(500).send({
      error: e,
      msg: 'Internal Server Error',
      success: false,
    });
  }
};
////////////////end OU

module.exports = {
  getLoggedInUser,
  userRegister,
  verifyUser,
  userLogin,
  forgotPassword,
  verifyForgotPassword,
  updateUserPassword,
  adminLogin,
  candidateRegister,
  uploadImage,
  addDetail,
  verifyCandidate,
  candidateLogin,
  forgotPasswordCandidate,
  verifyForgotPasswordCandidate,
  updateCandidatePassword,
};
