const bcrypt=require("bcrypt");
const User=require("../model/user")
const OTP=require("../model/otp")
const EmailOTP=require("../model/emailOtp")
const otpGenerator=require("otp-generator")
const Profile=require("../model/profile");
const jwt=require("jsonwebtoken");
const GameCurency=require("../model/gameMoney");

const mailsender=require("../mail/mailSender");
const emailOtp = require("../model/emailOtp");
const Admin=require("../model/admin");


require("dotenv").config();

// send OTP via email for admin verification
exports.sendOTP=async(req,res)=>{

    try {
        
        const{email}=req.body;
        const userExsist=await User.findOne({email});


        // generate otp
      var otp=otpGenerator.generate(6,{
        upperCaseAlphabets:false,
        lowerCaseAlphabets:false,
        specialChars:false
      });

      //check the unique otp or not
      let result= await EmailOTP.findOne({otp:otp});

      while(result)
      {
        otpGenerator.generate(6,{
            upperCaseAlphabets:false,
            lowerCaseAlphabets:false,
            specialChars:false
          });
          result= await EmailOTP.findOne({otp:otp});
      }

      const otpPayload={email ,otp};
      const otpBody=await EmailOTP.create(otpPayload);
      
      await mailsender(email,"OTP verification",otp);
      
      res.status(200).json({
        success:true,
        message:"Otp sent sucessfully",
        otp,
      })
    } catch (error) {

        res.status(500).json({
            success:false,
            message:error.message,

        })
    }
};

//verify otp/sign in for api for admin
exports.verifyOtp=async(req,res)=>{

    try {

        const{otp,email}=req.body;
        
        console.log(otp,email);
        const recentOTP=await emailOtp.findOne({email:email}).sort({createdAt:-1}).limit(1);


        let user=await Admin.findOne({ email})
        if(recentOTP.length ===0)
       {
        return res.status(400).json({
            success:false,
            message:"OTP not found"
        })
       }

       else if(otp !==recentOTP.otp){
        return res.status(401).json({
            success:false,
            message:"Invalid otp",
            data:otp,
            op:recentOTP
        });
    } 

    else{
           // create JWT tokens
           const payload={
            email:user.email,
            id:user._id,
            role: user.accountType
        }
       
        //payload , secretkey ,options
        const token=jwt.sign(payload,process.env.JWT_SECRET,{
            expiresIn: "1w"
        });
        user.token=token;
        user.password=undefined;
      
        //create cookie
        const options={
                     maxAge: 10 * 24 * 60 * 60 * 1000, // Expires after 3 days
                     httpOnly: true
               }
      return   res.cookie("token",  token, options).status(200).json({
            success:true,
            token,
            user,
            message:`Logedin successfully and token id ${token}`

        })
    }
  }
    catch (error) {
        console.log(error.message);
        return res.status(400).json({
            success:false,
            message:error
        })
    }
}

// sign in api 
exports.signup=async(req,res)=>{

    try {
        const{
            firstName,
            lastName,
            email,
            accountType,
            contactNumber,
            otp
             }=req.body;

       //check password match or not
        // verify otp , cause user only done sign up when email verififcation done before create a new entry in DB
        if(!firstName || !lastName || !email || !contactNumber || !otp)
        {
            return res.status(403).json({
                success:false,
                message:"all field are require"
            })
        }   
        
       

         // check user already present
         if(await User.findOne({email}))
         {
             return res.status(400).json({
                 success:false,
                 message:"user already exsist"
             })
         }

        
        //find most recent otp
        const recentOTP=await OTP.findOne({email:email}).sort({createdAt:-1}).limit(1);
        
        if(recentOTP.length ===0)
       {
        return res.status(400).json({
            success:false,
            message:"OTP not found"
        })
       }

       else if(otp !==recentOTP.otp){
        return res.status(401).json({
            success:false,
            message:"Invalid otp",
            data:otp,
            op:recentOTP
        });
       }



       //create crossponding Profile collection which use in additionals details
       const profile= await Profile.create({
        gender:null,
        dateOfBirth:null,
        about:null,
      
       });

       const gameCoin=await GameCurency.create({coins:0})
      
       //finaly create user in Data Base
       const user=await User.create({
        firstName,
        lastName,
        email,
        contactNumber,
        accountType,
        additonalDetails:profile._id,
        gameMoney:gameCoin._id,
        image:`https://api.dicebear.com/5.x/initials/svg?seed=${firstName} ${lastName}`,
       });

       return res.status(200).json({
        success:true,
        message:"User created successfully",
        data:user,
       })
    } catch (error) {
        return res.status(401).json({
            success:false,
            message:"Error in creating user",
            data:error.message,
        })
    }
}

// login api
exports.login=async(req,res)=>{

    try {
        
        // fetch the data from req body
        const{email,password}=req.body;

        //valid data or not
        if(!email || !password){
            return res.status(400).json({
                success:false,
                message:"All filed are require"
            })
        }

        // check user exist or not
        //need to populate game-coin also **REMAINING
        let user=await User.findOne({ email }).populate("additonalDetails");
        if(!user){
            return res.status(500).json({
                success:false,
                message:"User not exsist"
            })
        }

        //compare password
        if(await bcrypt.compare(password,user.password)){
         
            // create JWT tokens
            const payload={
                email:user.email,
                id:user._id,
                role: user.accountType
            }
           
            //payload , secretkey ,options
            const token=jwt.sign(payload,process.env.JWT_SECRET,{
                expiresIn: "1w"
            });
            user.token=token;
            user.password=undefined;
          
            //create cookie
            const options={
                maxAge: 10 * 24 * 60 * 60 * 1000, // Expires after 3 days
                httpOnly: true
            }
          return   res.cookie("token",  token, options).status(200).json({
                success:true,
                token,
                user,
                message:`Logedin successfully and token id ${token}`

            })

        }
        else{
            return res.status(401).json({
                success:false,
                message:"Password incorect"
            })
        }
    } catch (error) 
    {
        console.log(error);
        return res.status(500).json({
            success:false,
            message:"Login fail eroor in network call",
            data:error.message
        })
    }
}

// mobile otp snding for gammer
exports.mobileOtpSender=async(req,res)=>{

    try {
        const { phoneNumber } = req.body;
        const userExsist=await User.findOne({phoneNumber});

        if(userExsist){
            return res.status(400).json({
                success:false,
                message:"User already present "
            })
        }
       
         // generate otp
      var otp=otpGenerator.generate(6,{
        upperCaseAlphabets:false,
        lowerCaseAlphabets:false,
        specialChars:false
      });

      const otpPayload={phoneNumber ,otp};
      const otpBody=await OTP.create(otpPayload);

      const message=`Your otp is ${otp}`

      const response = await axios.post('https://enterprise.smsgupshup.com/GatewayAPI/rest', {
        method: 'SendMessage',
        send_to: phoneNumber,
        msg: message,
        msg_type: 'TEXT',
        userid: process.env.apiKey,
        auth_scheme: 'plain',
        password: process.env.apiKey,
        v: '1.1',
        format: 'text',
        mask:process.env.senderId,
      });
  
      console.log(response);
      return res.status(200).json({
        success:true, 
        message:"Otp send successfully"
      })
     
    } catch (error) {
        
        console.log(error.message);
        return res.status(400).json({
            success:false,
            mesage:"Faild to send otp",
            fault:error.message
        })
    }
}
