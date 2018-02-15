// app/models/user.js

// load stuff
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our user model
var UserSchema = mongoose.Schema({
  name : String,
  password : String,
  isSuperAdmin : Boolean,
  isAdmin : Boolean,
});

// methods
// generating a hash
UserSchema.methods.generateHash = function(password) {
  return bcrypt.hashSync( password, bcrypt.genSaltSync(12), null);
};

// checking if password is valid
UserSchema.methods.validPassword = function(password) {
  return bcrypt.compareSync( password, this.password );
};

UserSchema.methods.getPublicData = function() {
  return {
    id:this._id,
    name:this.name,
    isAdmin:this.isAdmin,
    isSuperAdmin:this.isSuperAdmin };
}

// create the model for users and expose it to our app
module.exports = mongoose.model('User', UserSchema, 'users');
