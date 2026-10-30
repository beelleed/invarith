export const shrinkContracts = {
  sum: { label: 'Sum all integers; empty list returns 0.', expected: values => values.reduce((sum,value)=>sum+value,0) },
  average: { label: 'Arithmetic mean of all integers; empty list returns 0.', expected: values => values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : 0 },
  any_positive: { label: 'Return true if any integer is positive; empty list returns false.', expected: values => values.some(value=>value>0) },
  first_even: { label: 'Return the first even integer, or null if none exists.', expected: values => values.find(value=>value%2===0) ?? null },
};
export const shrinkableCase=item=>item?.args?.length===1 && !Object.keys(item.kwargs || {}).length && Array.isArray(item.args[0]) && item.args[0].length<=32 && item.args[0].every(value=>Number.isInteger(value) && Math.abs(value)<=1000000);
