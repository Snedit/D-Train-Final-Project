import jwt from "jsonwebtoken";
// import dotenv from "dotenv";
// dotenv.config()
function signPayload(payload, expiresIn='7d')
{

    const secret = process.env.JWT_SECRET;

    const token = jwt.sign(
        {payload}, 
        secret,
        {expiresIn: expiresIn}
    )
    return token;

}



export {signPayload};