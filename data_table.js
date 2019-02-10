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
      },
      {
        name: "{column name 2}",
        pname: "{column name 2 (physical)}",
        pk: false,
        required: false,
        type: "text",
        size: 64,
        desc: "http://example.com/foo/bar"
      }
    ]
  },

  {
    name: "table2", // table name
    pname: "{table name (physical)}",
    desc: ["{line1}", "{line2}", "http://example.com/foo/bar"],
    cols: [
      {
        name: "{column name}",
        pname: "{column name (physical)}",
        pk: true, // primary key
        required: true,
        type: "int",
        size: 11,
        desc: ["{line1}", "{line2}"]
      },
      {
        name: "{column name 2}",
        pname: "{column name 2 (physical)}",
        pk: true, // primary key
        required: true,
        type: "int",
        size: 11,
        desc: ["{line1}", "{line2}", "http://example.com/foo/bar"]
      }
    ]
  }

  // ,{ ... } // table3
  // ...
];
