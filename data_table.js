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
  }

  // ,{ ... } // table2
  // ...
];
