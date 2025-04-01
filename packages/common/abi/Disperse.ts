export const DisperseAddress = "0xD152f549545093347A162Dce210e7293f1452150";

export const DisperseAbi = [
  {
    constant: false,
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "values", type: "uint256[]" },
    ],
    name: "disperseTokenSimple",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "values", type: "uint256[]" },
    ],
    name: "disperseToken",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "recipients", type: "address[]" },
      { name: "values", type: "uint256[]" },
    ],
    name: "disperseEther",
    outputs: [],
    payable: true,
    stateMutability: "payable",
    type: "function",
  },
] as const;
