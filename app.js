const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();

app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "password", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//login user
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserDetails = `SELECT *  FROM user WHERE username= '${username}';`;
  const checkUser = await db.get(getUserDetails);
  if (checkUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isMatchedPassword = await bcrypt.compare(
      password,
      checkUser.password
    );
    if (isMatchedPassword === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "password");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//{"jwtToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImNocmlzdG9waGVyX3BoaWxsaXBzIiwiaWF0IjoxNjg0MTE4MTYyfQ.FW7dI34MmtKnWBQWyF2r_B9A0Gk7mv3L1Lmmpy1rFCs"}

const convertStoC = (db) => {
  return {
    districtId: db.district_id,
    districtName: db.district_name,
    stateId: db.state_id,
    stateName: db.state_name,
    population: db.population,
    cases: db.cases,
    cured: db.cured,
    active: db.active,
    deaths: db.deaths,
  };
};
// get list of all states in state table
app.get("/states/", authentication, async (request, response) => {
  const stateDetails = `SELECT * FROM state;`;
  const dbResponse = await db.all(stateDetails);
  const camelCase = [];
  const values = dbResponse.map((eachState) => {
    let update = convertStoC(eachState);
    camelCase.push(update);
  });
  response.send(camelCase);
});

//creating district in district table
app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrict = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
                                VALUES('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}')`;
  await db.run(createDistrict);
  response.send("District Successfully Added");
});

//get district based on district_id
app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrict = `SELECT * FROM district WHERE district_id = ${districtId};`;
    const dbResponse = await db.get(getDistrict);
    response.send(convertStoC(dbResponse));
  }
);

//delete specific district
app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteDistrict);
    response.send("District Removed");
  }
);

//updating district based on id
app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrict = `UPDATE district
    SET district_name = '${districtName}',
        state_id = ${stateId},
        cases= ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHere district_id = ${districtId};`;
    await db.run(updateDistrict);
    response.send("District Details Updated");
  }
);

//getting stats of total cases;
app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const getStats = `
    SELECT 
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
    FROM 
    district
    WHERE state_id = ${stateId};`;
    const stats = await db.get(getStats);
    response.send({
      totalCases: stats.totalCases,
      totalCured: stats.totalCured,
      totalActive: stats.totalActive,
      totalDeaths: stats.totalDeaths,
    });
  }
);

//get state based on id
app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const getState = `SELECT state_id,state_name, population FROM state WHERE state_id = ${stateId};`;
  const dbState = await db.get(getState);
  response.send(convertStoC(dbState));
});

module.exports = app;
