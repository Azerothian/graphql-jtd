import {generateJDTMinFromSchema} from "../src/index";
import demoSchema from "./utils/demo-schema";
import customSchema from "./utils/custom-schema";
import { JtdMinType } from "@vostro/jtd-types";


import { buildSchema } from "graphql";
import exp from "constants";

test("jtd schema - root elements test", () => {
  const rootSchema = generateJDTMinFromSchema(demoSchema);
  expect(rootSchema.p?.Query).not.toBeNull();
  expect(rootSchema.p?.Mutation).not.toBeNull();
  expect(rootSchema.p?.Query.md?.n).toEqual("Query")

});

test("jtd schema - arguments test", () => {
  const rootSchema = generateJDTMinFromSchema(demoSchema);
  const queryTest1 = rootSchema.p?.Query.p?.queryTest1;
  expect(queryTest1?.args).not.toBeNull();
    // .definitions?.Person.arguments?.req?.type).toEqual(JtdType.STRING);
});


test("jtd schema - basic types - input and result", async() => {
  const rootSchema = generateJDTMinFromSchema(demoSchema);
  expect(rootSchema).toBeDefined();
  expect(rootSchema.def?.test1Result).toBeDefined();
  expect(rootSchema.def?.test1input1).toBeDefined();
});




test("jtd schema - basic types - boolean", async() => {
  const rootSchema = generateJDTMinFromSchema(demoSchema);
  expect(rootSchema).toBeDefined();
  expect(rootSchema.p?.Query?.p?.testBoolean?.t).toBe(JtdMinType.BOOLEAN);
});

test("jtd schema - custom types - no resolver", async() => {
  const rootSchema = generateJDTMinFromSchema(customSchema);
  expect(rootSchema).toBeDefined();
  expect(rootSchema.p?.Query?.p?.hello?.t).toBe(JtdMinType.STRING);
  expect(rootSchema.p?.Query?.p?.date?.t).toBe(JtdMinType.UNKNOWN);
});


test("jtd schema - custom types - with custom resolver", async() => {
  const rootSchema = generateJDTMinFromSchema(customSchema, {
    customScalarResolver: (name, type) => {
      if (type.toString() === "GQLTDate") {
        return JtdMinType.TIMESTAMP;
      }
      return undefined
    }
  });
  expect(rootSchema).toBeDefined();
  expect(rootSchema.p?.Query?.p?.hello?.t).toBe(JtdMinType.STRING);
  expect(rootSchema.p?.Query?.p?.date?.t).toBe(JtdMinType.TIMESTAMP);
});

test("jtd schema - id type", async() => {
  const rootSchema = generateJDTMinFromSchema(customSchema);
  expect(rootSchema).toBeDefined();
  expect(rootSchema.p?.Query?.p?.id?.t).toBe(JtdMinType.STRING);
  expect(rootSchema.p?.Query?.p?.id?.md?.id).toBe(true);
  expect(rootSchema.p?.Query?.p?.hello?.md).toBeUndefined();
});



test("jtd schema - custom types - scalarPostProcessor", async() => {


  const testSchema = buildSchema(`
    type PageInfo {
      hasNextPage: Boolean
      hasPreviousPage: Boolean
      startCursor: String
      endCursor: String
    }
    
    
    type Parent {
      id: ID
      children: ChildEdge
    }
    
    type ChildEdge {
      edges: [ChildNode]
      pageInfo: PageInfo
    }
    type ChildNode {
      node: Child
    }
    type Child {
      id: ID
      parent: Parent
      parentId: ID
    }
    type Models {
      children: [ChildEdge]
    }
    type Query {
      models: Models
    }
    `, {
      
    });
    
    


  const rootSchema = generateJDTMinFromSchema(testSchema, {
    scalarPostProcessor: (typeDef, name, type, currentObject, isScalarType) => {
      if(name === "parentId" && typeDef.md) {
        typeDef.md = {...typeDef.md, n: "parent"};
      }
      return typeDef;
    }
  });
  expect(rootSchema).toBeDefined();
  expect(rootSchema?.def?.Child?.p?.parentId?.md?.n).toEqual("parent");
});