const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const app = express();
const cookieParser = require("cookie-parser");
const corsOptions = {
  origin: [
    // "http://localhost:5000",
    "http://localhost:5173",
    "http://localhost:5175",
  ],
  credentials: true,
  optionalSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
// solosphere
// VMbFDyABSBqeTxXa

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@main.yolij.mongodb.net/?retryWrites=true&w=majority&appName=Main`;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.i7pwp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// verifyToken
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "unauthorized access" });
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
  });
  next();
};

async function run() {
  try {
    const db = client.db("solo-db");
    const jobsCollection = db.collection("jobs");
    const bidsCollection = db.collection("bids");

    // generate jwt
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      // create token
      const token = jwt.sign(email, process.env.SECRET_KEY, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // logout||clear cookie from server
    app.get("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          maxAge: 0,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // saveJob data in db
    app.post("/add-job", async (req, res) => {
      const jobData = req.body;
      const result = await jobsCollection.insertOne(jobData);
      res.send(result);
    });
    // get all data
    app.get("/jobs", async (req, res) => {
      const result = await jobsCollection.find().toArray();
      res.send(result);
    });

    // fetched by email
    app.get("/jobs/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { "buyer.email": email };
      const decodedEmail = req.user?.email;
      if (decodedEmail !== email)
        return res.status(401).send({ message: "unauthorized access" });
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });
    // delete a job
    app.delete("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.deleteOne(query);
      res.send(result);
    });
    // get a single data by id from db
    app.get("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });
    // data updated to db
    app.put("/update-job/:id", async (req, res) => {
      const id = req.params.id;
      const jobData = req.body;
      const updated = {
        $set: jobData,
      };
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const result = await jobsCollection.updateOne(query, updated, options);
      res.send(result);
    });

    // // save a bid data in db
    // app.post("/add-bid", async (req, res) => {
    //   const bidData = req.body;
    //   // is user already placed in this bid?
    //   const query = { email: bidData.email, jobId: bidData.jobId };
    //   const alreadyExist = await bidsCollection.findOne(query);
    //   console.log("Already exist", alreadyExist);
    //   if (alreadyExist)
    //     return res
    //       .status(400)
    //       .send("You have already placed a bid on this job!");
    //   // save data in bidsCollection
    //   const result = await bidsCollection.insertOne(bidData);

    //   // 2.Increase bid count in jobs collection
    //   const filter = { _id: new ObjectId(bidData.jobId) };
    //   const update = {
    //     $inc: { bid_count: 1 },
    //   };
    //   const updateBidCount = await jobsCollection.updateOne(filter, update);

    //   res.send(result);
    // });

    // save a bid data in db
    app.post("/add-bid", async (req, res) => {
      const bidData = req.body;
      // 0. if a user placed a bid already in this job
      const query = { email: bidData.email, jobId: bidData.jobId };
      const alreadyExist = await bidsCollection.findOne(query);
      console.log("If already exist-->", alreadyExist);
      if (alreadyExist)
        return res
          .status(400)
          .send("You have already placed a bid on this job!");
      // 1. Save data in bids collection

      const result = await bidsCollection.insertOne(bidData);

      // 2. Increase bid count in jobs collection
      const filter = { _id: new ObjectId(bidData.jobId) };
      const update = {
        $inc: { bid_count: 1 },
      };
      const updateBidCount = await jobsCollection.updateOne(filter, update);
      console.log(updateBidCount);
      res.send(result);
    });

    // get all bids for a specific user
    // app.get("/bids/:email", async (req, res) => {
    //   const email = req.params.email;
    //   const isBuyer = req.query.buyer;
    //   let query = {};
    //   if (isBuyer) {
    //     query.buyer = email;
    //   } else {
    //     query.email = email;
    //   }
    //   const result = await bidsCollection.find(query).toArray();
    //   res.send(result);
    // });
    app.get("/bids/:email", verifyToken, async (req, res) => {
      const isBuyer = req.query.buyer;
      const email = req.params.email;
      const decodedEmail = req.user?.email;
      if (decodedEmail !== email)
        return res.status(401).send({ message: "unauthorized access" });

      let query = {};
      if (isBuyer) {
        query.buyer = email;
      } else {
        query.email = email;
      }

      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    });

    // get all bids requests for a specific user
    // app.get("/bid-requests/:email", verifyToken, async (req, res) => {
    //   const email = req.params.email;
    //   const query = { buyer: email };
    //   const decodedEmail = req.user?.email;
    //   if (decodedEmail !== email)
    //     return res.status(401).send({ message: "unauthorized access" });

    //   const result = await bidsCollection.find(query).toArray();
    //   res.send(result);
    // });

    // update bid status
    // app.patch("/bid-status-update/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const { status } = req.body;
    //   const filter = { _id: new ObjectId(id) };
    //   const updated = {
    //     $set: { status },
    //   };
    //   const result = await bidsCollection.updateOne(filter, updated);
    //   res.send(result);
    // });
    app.patch("/bid-status-update/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      const filter = { _id: new ObjectId(id) };
      const updated = {
        $set: { status },
      };
      const result = await bidsCollection.updateOne(filter, updated);
      res.send(result);
    });

    // get all jobs
    // app.get("/all-jobs", async (req, res) => {
    //   const search = req.query.search;
    //   const filter = req.query.filter;
    //   let query = {
    //     title: {
    //       $regex: search,
    //       $options: "i",
    //     },
    //   };
    //   if (filter) query.category = filter;

    //   const result = await jobsCollection.find(query).toArray();
    //   res.send(result);
    // });
    app.get("/all-jobs", async (req, res) => {
      const search = req.query.search || ""; // Default to empty string if not provided
      const filter = req.query.filter;
      const sort = req.query.sort;
      let query = {};
      let options = {};
      // Add category filter if provided
      if (filter) {
        query.category = filter;
      }
      if (sort) options = { sort: { deadline: sort === "asc" ? 1 : -1 } };

      // Add search filter for title if `search` is not empty
      if (search.trim()) {
        query.title = {
          $regex: search.split(" ").join(".*"), // Matches any sequence of words or alphabets
          $options: "i", // Case-insensitive
        };
      }

      // Fetch jobs from the collection
      const result = await jobsCollection.find(query, options).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Hello from SoloSphere Server....");
});

app.listen(port, () => console.log(`Server running on port ${port}`));
