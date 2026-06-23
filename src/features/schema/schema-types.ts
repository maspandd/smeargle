export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "email"
  | "object"
  | "array";

export type BaseFieldDefinition = {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
};

export type StringField = BaseFieldDefinition & {
  type: "string";
  minLength?: number;
  maxLength?: number;
};

export type NumberField = BaseFieldDefinition & {
  type: "number";
  min?: number;
  max?: number;
  precision?: number;
};

export type BooleanField = BaseFieldDefinition & {
  type: "boolean";
};

export type DateField = BaseFieldDefinition & {
  type: "date";
  minDate?: string;
  maxDate?: string;
};

export type SemanticField = BaseFieldDefinition & {
  type: "email";
};

export type ObjectField = BaseFieldDefinition & {
  type: "object";
  fields: FieldDefinition[];
};

export type ArrayField = BaseFieldDefinition & {
  type: "array";
  item: FieldDefinition;
  minItems?: number;
  maxItems?: number;
};

export type FieldDefinition =
  | StringField
  | NumberField
  | BooleanField
  | DateField
  | SemanticField
  | ObjectField
  | ArrayField;

export type SchemaSnapshot = {
  fields: FieldDefinition[];
};
