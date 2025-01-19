import { JtdType } from "@vostro/jtd-types";
import {generateJDTFromSchema} from "../src/index";
import customSchema from "./utils/custom-schema";
import demoSchema from "./utils/demo-schema";
import { buildSchema } from "graphql";


test("jtd schema - root elements test", () => {
  const rootSchema = generateJDTFromSchema(demoSchema);
  expect(rootSchema.optionalProperties?.Query).not.toBeNull();
  expect(rootSchema.optionalProperties?.Mutation).not.toBeNull();
  expect(rootSchema.optionalProperties?.Query.metadata?.name).toEqual("Query")
  expect(rootSchema.optionalProperties?.Query.metadata?.rootElement).toEqual(true)
});

test("jtd schema - arguments test", () => {
  const rootSchema = generateJDTFromSchema(demoSchema);
  const queryTest1 = rootSchema.optionalProperties?.Query.properties?.queryTest1;
  expect(queryTest1?.arguments).not.toBeNull();
    // .definitions?.Person.arguments?.req?.type).toEqual(JtdType.STRING);
});


test("jtd schema - basic types - input and result", async() => {
  const rootSchema = generateJDTFromSchema(demoSchema);
  expect(rootSchema).toBeDefined();
  expect(rootSchema.definitions?.test1Result).toBeDefined();
  expect(rootSchema.definitions?.test1input1).toBeDefined();
});


test("jtd schema - basic types - boolean", async() => {
  const rootSchema = generateJDTFromSchema(demoSchema);
  expect(rootSchema).toBeDefined();
  expect(rootSchema.optionalProperties?.Query?.optionalProperties?.testBoolean?.type).toBe(JtdType.BOOLEAN);
});

test("jtd schema - custom types - no resolver", async() => {
  const rootSchema = generateJDTFromSchema(customSchema);
  expect(rootSchema).toBeDefined();
  expect(rootSchema.optionalProperties?.Query?.optionalProperties?.hello?.type).toBe(JtdType.STRING);
  expect(rootSchema.optionalProperties?.Query?.optionalProperties?.date?.type).toBe(JtdType.UNKNOWN);
});


test("jtd schema - custom types - with custom resolver", async() => {
  const rootSchema = generateJDTFromSchema(customSchema, {
    customScalarResolver: (name, type) => {
      if (type.toString() === "GQLTDate") {
        return JtdType.TIMESTAMP;
      }
      return undefined
    }
  });
  expect(rootSchema).toBeDefined();
  expect(rootSchema.optionalProperties?.Query?.optionalProperties?.hello?.type).toBe(JtdType.STRING);
  expect(rootSchema.optionalProperties?.Query?.optionalProperties?.date?.type).toBe(JtdType.TIMESTAMP);
});


test("jtd schema - id type", async() => {
  const rootSchema = generateJDTFromSchema(customSchema);
  expect(rootSchema).toBeDefined();
  expect(rootSchema.optionalProperties?.Query?.optionalProperties?.id?.type).toBe(JtdType.STRING);
  expect(rootSchema.optionalProperties?.Query?.optionalProperties?.id?.metadata?.id).toBe(true);
  expect(rootSchema.optionalProperties?.Query?.optionalProperties?.hello?.metadata).toBeUndefined();
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
    
    


  const rootSchema = generateJDTFromSchema(testSchema, {
    scalarPostProcessor: (typeDef, name, type, currentObject, isScalarType) => {
      if(name === "parentId" && typeDef.metadata) {
        typeDef.metadata = {...typeDef.metadata, name: "parent"};
      }
      return typeDef;
    }
  });
  expect(rootSchema).toBeDefined();
  expect(rootSchema?.definitions?.Child?.optionalProperties?.parentId?.metadata?.name).toEqual("parent");
});


test("jtd schema - test required input", async() => {
  const testSchema = buildSchema(`
    input ChildInput {
      parentId: ID!
    }
    type Child {
      id: ID
      parentId: ID!
    }

    type Mutation {
      crateChild(input: ChildInput): Child
    }
    `, {
     
    });

  const rootSchema = generateJDTFromSchema(testSchema);
  expect(rootSchema).toBeDefined();
  expect(rootSchema?.definitions?.ChildInput?.properties?.parentId?.nullable).toEqual(false);
});