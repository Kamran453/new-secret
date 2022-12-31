//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const cool = require("cool-ascii-faces");

const app = express();

app.use(bodyParser.urlencoded({extended:true}));

app.set("view engine","ejs");

app.use(express.static(__dirname + '/public'));

app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true

}));

app.use(passport.initialize());
app.use(passport.session());

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB,{useNewUrlParser:true});;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}



const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  username: String,
  secret: String

});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new  mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id,function(err,user){
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRETS,
    callbackURL: process.env.CALLBACK_URL,
    // userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id, username: profile.emails[0].value}, function (err, user) {
      return cb(err, user)
    });
  }
));

app.get("/",function(req,res){
  res.render("home")
});

app.get("/cool",function(req,res){
  res.send(cool());
});

app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile","https://www.googleapis.com/auth/userinfo.email"] }));

app.get("/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  });

app.get("/register",function(req,res){
  res.render("register")
});

app.post("/register", function(req, res) {
  User.register({username:req.body.username},req.body.password,function(err,user){
    if(err){
      console.log(err);
      res.send("username alreday exist");
    }else{
      passport.authenticate("local")(req,res,function(){
        res.send("usename created successfully, Please Login");
      });
    }
  });
});

app.get("/login",function(req,res){
  res.render("login")
});

// app.post("/login", function(req, res) {
//
//   const user = new User({
//     username: req.body.username,
//     password: req.body.password
//   })
//   req.login(user, function(err) {
//     if (err) {
//       console.log(err);
//       res.redirect("/login");
//     } else {
//       passport.authenticate("local")(req, res, function() {
//         res.redirect("/secrets");
//       });
//     }
//   });
//
// });

app.post('/login/password',
  passport.authenticate('local', { failureRedirect: '/login', failureMessage: true }),
  function(req, res) {
    res.redirect("/secrets");
  });

app.get("/secrets",function(req,res){
  User.find({"secret":{$ne:null}}, function(err,foundUser){
    if(err){
      console.log(err);
    }else {
      if(foundUser){
        if(req.isAuthenticated()){
          res.render("secrets", {userWithSecrets: foundUser});
        }else{
          res.redirect("/login");
        }

      }
    }
  } )
});

app.get("/submit",function(req,res){
  if(req.isAuthenticated()){
    res.render("submit");
  }else{
    res.redirect("/login");
  }
});

app.post("/submit", function(req, res) {

  const submittedSecret = req.body.secret;
  User.findById(req.user.id, function(err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        foundUser.save();
        res.redirect("/secrets");
      }
    }
  });
});

app.get("/logout",function(req,res){
  req.logout(function(err){
    if(err){
      console.log(err);
    }
  });
  res.redirect("/");
})

let port = process.env.PORT;
if (port == null || port == "") {
  port = 5000;
}

connectDB().then(() => {
  app.listen(port, () => {
      console.log("listening for requests");
  })
})


// app.listen(3000,function(){
//   console.log("Port 3000 started");
// });
