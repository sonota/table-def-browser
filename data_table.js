var data = [
  {
    name: "table1", // table name
    pname: "{table name (physical)}",
    desc: "{table description}",
    cols: [
      {
        name: "{column name}",
        pname: "{column name (physical)}",
        pk: true, // primary key
        required: true,
        type: "int",
        size: 11,
        desc: "column description"
      }
    ]
  },

  {
    name: "table2", // table name
    pname: "{table name (physical)}",
    desc: ["{line1}", "{line2}"],
    cols: [
      {
        name: "{column name}",
        pname: "{column name (physical)}",
        pk: true, // primary key
        required: true,
        type: "int",
        size: 11,
        desc: ["{line1}", "{line2}"]
      }
    ]
  }

  // ,{ ... } // table3
  // ...
];
