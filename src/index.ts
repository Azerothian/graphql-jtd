import logger from "./utils/logger";
import {GraphQLFieldConfig, GraphQLFieldConfigArgumentMap, GraphQLInputObjectType, GraphQLInputObjectTypeConfig, GraphQLObjectTypeConfig} from "graphql";
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLType,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLList,
} from "graphql";
import { IJtd, IJtdDict, IJtdMin, IJtdRoot, JtdMinType, JtdType } from '@vostro/jtd-types';
import { GraphQLSchemaNormalizedConfig } from "graphql/type/schema";

import {generateJDTMinFromSchema as gjmfs} from "./min"

type CustomScalerResolver =  (type: GraphQLType) => JtdType | undefined;

function createType(fieldType: GraphQLType, name: string, currentObject: JtdCurrentObject, options?: generateJTDOptions) {
  // const fieldType = !(field as GraphQLFieldConfig<any, any, any>).type ? field as GraphQLType : (field as GraphQLFieldConfig<any, any, any>).type;
  const required = fieldType instanceof GraphQLNonNull;
  let type: GraphQLType;
  if (required) {
    type = (fieldType as GraphQLNonNull<GraphQLType>).ofType;
  } else {
    type = fieldType;
  }
  let isList = false;
  if (type instanceof GraphQLList) {
    isList = true;
    type = type.ofType;
  }
  let typeName = type.toString();
  let typeDef = {} as IJtd;
  let isScaler = false;
  if (type instanceof GraphQLScalarType) {
    isScaler = true;
    switch (typeName) {
      case "Int":
        typeDef = { type: JtdType.INT32 };
        break;
      case "ID":
        typeDef = { type: JtdType.STRING, metadata: { id: true } };
        break;
      case "String":
        typeDef = { type: JtdType.STRING };
        break;
      case "Float":
        typeDef = { type: JtdType.FLOAT32 };
        break;
      case "Boolean":
        typeDef = { type: JtdType.BOOLEAN };
        break;
      default:
        let customScalarType;
        if(options?.customScalarResolver) {
          customScalarType = options?.customScalarResolver(name, type, currentObject);
        }
        if (customScalarType) {
          typeDef = { type: customScalarType };
        } else {
          typeDef = { type: JtdType.UNKNOWN };
          logger.err(`no scalar type found for ${typeName}`);
        }
        break;
    }
  } else if (type instanceof GraphQLObjectType) {
    typeDef = { ref: type.name };
  } else if (type instanceof GraphQLInputObjectType) {
    typeDef = { ref: type.name };
  } else if (type instanceof GraphQLEnumType) {
    typeDef = { ref: type.name };
  // } else if (type instanceof GraphQLList) {
  //   throw "TODO: List in list - needs implementing";
  } else {
    logger.err(`unknown gql type ${typeName}`);
  }
  if (isList) {
    typeDef = {elements: typeDef}
  }
  if(required) {
    typeDef.nullable = false;
  } else {
    typeDef.nullable = true;
  }
  
  if(options?.scalarPostProcessor) {
    const tmpDef = options.scalarPostProcessor(typeDef, name, type, currentObject, isScaler);
    if(tmpDef) {
      typeDef = tmpDef
    }

  }
  // if(obj?.args) {
  //     typeDef.arguments = Object.keys(obj.args).reduce((o, a) => {
  //     if(obj?.args) {
  //       o[a] = createType(obj?.args[a]);
  //     }
  //     return o;
  //   }, {} as IJtdDict);
  // }
  return typeDef;
}

export function createArguments(argMap: GraphQLFieldConfigArgumentMap | undefined, currentObject: JtdCurrentObject, options?: generateJTDOptions) : IJtdDict | undefined {
  if (argMap) {
    const keys = Object.keys(argMap);
    if(keys.length > 0) {
      return keys.reduce((o, k) => {
        o[k] = createType(argMap[k].type, k, currentObject, options);
        return o;
      }, {} as IJtdDict);
    }
  }
  return undefined;
}
function objectMapper(obj: GraphQLObjectType | GraphQLInputObjectType, schemaConfig: GraphQLSchemaNormalizedConfig, options?: generateJTDOptions) {
  const objectConfig = obj.toConfig();
  const objType = obj[Symbol.toStringTag];
  const currentObject = {
    type: objType,
    data: objectConfig,
  }
  const metadata = {
    name: objectConfig.name,
  } as any;
  if (obj === schemaConfig.query || obj === schemaConfig.mutation || obj === schemaConfig.subscription) {
    metadata.rootElement = true;
  }
  return Object.keys(objectConfig.fields).reduce(
    (o, k) => {
      const field = objectConfig.fields[k];
      const typeDef = createType(field.type, k, currentObject, options);
      if (obj instanceof GraphQLObjectType) {
        typeDef.arguments = createArguments((field as GraphQLFieldConfig<any, any,any>).args, currentObject, options);
      }
      if (!typeDef.nullable) {
        if (!o.properties) {
          o.properties = {};
        }
        o.properties[k] = typeDef;
      } else {
        if (!o.optionalProperties) {
          o.optionalProperties = {};
        }
        o.optionalProperties[k] = typeDef;
      }
      return o;
    },
    {
      metadata,
      properties: {},
      optionalProperties: {},
    } as IJtd
  );
}

export function createTypes(schemaConfig: GraphQLSchemaNormalizedConfig, options?: generateJTDOptions) {
  const enums = schemaConfig.types.filter(
    (f) => f instanceof GraphQLEnumType && f.name.indexOf("__") !== 0
  ) as GraphQLEnumType[];
  const objects = schemaConfig.types.filter(
    (f) => f instanceof GraphQLObjectType && f.name.indexOf("__") !== 0
  ) as GraphQLObjectType[];
  const inputs = schemaConfig.types.filter(
    (f) => f instanceof GraphQLInputObjectType && f.name.indexOf("__") !== 0
  ) as GraphQLInputObjectType[]

  return [
    ...inputs.map((i) => objectMapper(i, schemaConfig, options)),
    ...objects.map((o) => objectMapper(o, schemaConfig, options)),
    ...enums.map((enumType) => {
      return {
        metadata: {
          name: enumType.name,
        },
        enum: enumType.getValues().map((v) => v.name),
      } as IJtd;
    }),
  ];
}


export function generateJTDFromTypes(types: IJtd[], metadata = {}) {
  const definitions = types
    .filter((t) => !t.metadata?.rootElement)
    .reduce((o, t) => {
      if (t.metadata?.name) {
        o[t.metadata?.name] = t;
      }
      return o;
    }, {} as IJtdDict)
  const optionalProperties = types
    .filter((t) => t.metadata?.rootElement)
    .reduce((o, t) => {
      if (t.metadata?.name) {
        o[t.metadata?.name] = t;
      }
      return o;
    }, {} as IJtdDict)
  return {
    metadata,
    definitions,
    optionalProperties
  } as IJtdRoot
}

export function generateJDTFromSchema(schema: GraphQLSchema, options?: generateJTDOptions) {
  const schemaConfig = schema.toConfig();
  const types = createTypes(schemaConfig, options);
  return generateJTDFromTypes(types, {
    mutation: schemaConfig.mutation?.name,
    query: schemaConfig.query?.name,
  });
}

export const generateJDTMinFromSchema = gjmfs;


export interface JtdCurrentObject {
  type: string,
  data: GraphQLInputObjectTypeConfig | GraphQLObjectTypeConfig<any, any>
}

export type generateJTDOptions = {
  customScalarResolver?: (fieldName: string, fieldType: GraphQLType, currentObject: JtdCurrentObject) => JtdType | undefined;
  scalarPostProcessor?: (typeDef: IJtd, fieldName: string, fieldType: GraphQLType, currentObject: JtdCurrentObject, isScalarType: boolean) => IJtd | undefined
}

export type generateJTDMinOptions = {
  customScalarResolver?: (fieldName: string, fieldType: GraphQLType, currentObject: JtdCurrentObject) => JtdMinType | undefined;
  scalarPostProcessor?: (typeDef: IJtdMin, fieldName: string, fieldType: GraphQLType, currentObject: JtdCurrentObject, isScalarType: boolean) => IJtdMin | undefined
}

// export interface iJtdType {} 
// export interface iJtd {}