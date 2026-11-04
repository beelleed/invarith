import nodemailer from 'nodemailer';
import {AppError} from './verification.mjs';

export function createAccountMailer(env=process.env){
 const ready=Boolean(env.MAIL_SMTP_HOST&&env.MAIL_SMTP_USER&&env.MAIL_SMTP_PASSWORD&&env.MAIL_FROM);
 const port=Number(env.MAIL_SMTP_PORT||587);
 let transport;
 return {ready:ready&&[465,587].includes(port),async send(message){
  if(!ready||![465,587].includes(port))throw new AppError(503,'Email delivery is not configured. Use your recovery key for now.');
  transport??=nodemailer.createTransport({host:env.MAIL_SMTP_HOST,port,secure:port===465,requireTLS:true,auth:{user:env.MAIL_SMTP_USER,pass:env.MAIL_SMTP_PASSWORD},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000,disableFileAccess:true,disableUrlAccess:true});
  try{const result=await transport.sendMail({from:env.MAIL_FROM,...message});if(!result.accepted?.length)throw Error('Message rejected');}catch{throw new AppError(503,'The email could not be sent. Try again later or use your recovery key.');}
 }};
}
