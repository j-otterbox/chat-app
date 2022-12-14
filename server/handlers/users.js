const { client, preparedStmts } = require("../modules/db");
const {
  createJWT,
  comparePasswords,
  hashPassword,
} = require("../modules/auth");

module.exports.createNewUser = async (req, res) => {
  const { username, email, password } = req.body;
  const passwordHash = await hashPassword(password);
  const params = {
    username,
    email,
    passwordHash,
    timestamp: new Date(),
  };
  const query = preparedStmts.createNewUser(params);

  try {
    const queryRes = await client.query(query);
    const user = queryRes.rows[0]; // db returns data needed for token
    const token = createJWT(user);

    res.statusCode = 201;
    res.cookie("auth-token", token, { httpOnly: true });
    res.json({
      message: "201 | Created",
      id: user.id,
      username: user.username,
    });
  } catch (err) {
    let conflict;

    if (err.constraint === "users_username_key") {
      conflict = "username";
    } else if (err.constraint === "users_email_key") {
      conflict = "email";
    }

    res.statusCode = 409;
    res.json({ message: "409 | Resource Already Exists", conflict });
  }
};

module.exports.getUserById = async (req, res) => {
  const { id } = req.params;
  const query = preparedStmts.getUserById(id);

  try {
    const queryRes = await client.query(query);
    res.statusCode = 200;
    res.json({ message: "200 | OK", data: queryRes.rows });
  } catch (err) {
    res.statusCode = 500;
    res.json({ message: "500 | Internal Server Error" });
  }
};

module.exports.signIn = async (req, res) => {
  const { username, password } = req.body;
  const query = preparedStmts.getUserByUsername(username);

  try {
    const queryRes = await client.query(query);
    const user = queryRes.rows[0];
    const passwordsMatch = await comparePasswords(password, user.password_hash);

    if (passwordsMatch) {
      const token = createJWT({
        id: user.id,
        username: user.username,
      });
      res.statusCode = 200;
      res.cookie("auth-token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
      });
      res.json({ message: "200 | OK", id: user.id, username: user.username });
    } else {
      throw Error;
    }
  } catch (err) {
    res.statusCode = 401;
    res.json({
      message: "401 | Bad Request",
      detail: "Invalid username and password combination",
    });
  }
};

module.exports.signOut = (req, res) => {
  res.clearCookie("auth-token");
  res.statusCode = 200;
  res.json({ message: "200 | OK" });
};
