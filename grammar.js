/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// Aski v0.12 — tree-sitter grammar
// Derived from grammar/*.aski (the authoritative parser).
// Spec: encoder/design/v0.12/syntax.aski

const PREC = {
  RETURN:      1,
  YIELD:       1,
  LOGICAL_OR:  2,
  LOGICAL_AND: 3,
  EQUALITY:    4,
  COMPARE:     5,
  ADD:         6,
  MULTIPLY:    7,
  POSTFIX:     8,
  ACCESS:      9,
  CALL:       10,
};

module.exports = grammar({
  name: 'aski',

  extras: $ => [/\s/, $.comment],
  word: $ => $._lower_ident,

  conflicts: $ => [
    [$.variant, $.trait_decl],
    [$.binding, $._primary_expr],
    [$.mutable_set, $._primary_expr],
    [$.commit_arm],
    [$.backtrack_arm, $.destructure_arm],
    [$._arm_pattern, $._primary_expr],
    [$.type_alias],
    [$.struct_construction_arg],
    [$.sub_type_decl, $._primary_expr],
    [$.binding, $.deferred_new, $._primary_expr],
    [$.binding, $._primary_expr],
    [$.mutable_set, $._primary_expr],
    [$.mutable_new, $.binding],
    [$.mutable_borrow_ref, $.binding, $.mutable_new],
    [$.mutable_borrow_ref, $.mutable_set],
    [$.associated_type],
    [$.param],
    [$._type, $.variant],
    [$.borrow_type, $.struct_field],
    [$.trait_method_sig],
    [$.impl_member],
    [$.binding, $.deferred_new],
  ],

  rules: {
    source_file: $ => seq(
      optional($.module_header),
      repeat($._item),
    ),

    // ── Comments ──
    comment: $ => token(seq(';;', /.*/)),

    // ── Identifiers ──
    _upper_ident: $ => /[A-Z][a-zA-Z0-9]*/,
    _lower_ident: $ => /[a-z][a-zA-Z0-9]*/,
    type_identifier: $ => $._upper_ident,
    identifier: $ => $._lower_ident,

    // ── Special references ──
    instance_ref: $ => seq('@', $._upper_ident),
    self_ref: $ => '@Self',
    borrow_ref: $ => seq(':', choice($.instance_ref, $.self_ref)),
    mutable_borrow_ref: $ => seq('~', choice($.instance_ref, $.self_ref)),
    const_ref: $ => seq('!', choice($._upper_ident, $._lower_ident)),
    wildcard: $ => '_',
    stub: $ => '___',
    self_type: $ => 'Self',

    // ── Literals ──
    float_literal: $ => /[0-9]+\.[0-9]+/,
    integer_literal: $ => /[0-9]+/,
    string_literal: $ => seq('"', repeat(choice(
      $.string_content,
      $.string_interpolation,
    )), '"'),
    string_content: $ => token.immediate(prec(-1, /[^"$\\]+/)),
    string_interpolation: $ => seq(token.immediate('$'), $._upper_ident),

    // ── Type references ──
    // @Type in the grammar only matches PascalCase.
    _type: $ => choice(
      $.generic_type,
      $.type_identifier,
      $.self_type,
      $.borrow_type,
      $.trait_bound_type,
    ),
    generic_type: $ => prec(PREC.CALL, seq(
      $._upper_ident, token.immediate('{'), repeat1($._type), '}',
    )),
    borrow_type: $ => seq(':', $._type),
    trait_bound_type: $ => seq('{|', $.trait_bound, '|}'),
    trait_bound: $ => seq($.identifier, repeat(seq('&', $.identifier))),

    // ── Module header: (Name exports) [imports] {constraints} ──
    module_header: $ => seq(
      '(', field('name', $.type_identifier), repeat(choice($.type_identifier, $.identifier)), ')',
      optional($.import_block),
      optional($.constraint_block),
    ),
    import_block: $ => seq('[', repeat($.import_entry), ']'),
    import_entry: $ => seq(
      field('module', $.type_identifier),
      '(', repeat(choice($.type_identifier, $.identifier, '*')), ')',
    ),
    constraint_block: $ => seq('{', repeat($.type_identifier), '}'),

    // ── Top-level items ──
    _item: $ => choice(
      $.domain_decl,
      $.struct_decl,
      $.const_decl,
      $.trait_decl,
      $.trait_impl,
      $.grammar_rule,
      $.ffi_block,
      $.main_block,
      $.type_alias,
    ),

    // ── Domain: Name (Variant1 Variant2 ...) ──
    domain_decl: $ => prec.dynamic(1, seq(
      field('name', $.type_identifier),
      '(', repeat1($.variant), ')',
    )),
    variant: $ => seq(
      $.type_identifier,
      optional(choice(
        seq('(', choice($._type, repeat1($.variant)), ')'),
        seq('{', repeat1($.struct_field), '}'),
      )),
    ),

    // ── Struct: Name { Field Type ... } ──
    struct_decl: $ => seq(
      field('name', $.type_identifier), '{', repeat1($.struct_field), '}',
    ),
    struct_field: $ => seq(
      field('name', $.type_identifier),
      optional(':'),
      field('type', $._type),
    ),

    // ── Constant: !Name Type {value} ──
    const_decl: $ => seq(
      '!', field('name', choice($._upper_ident, $._lower_ident)),
      field('type', $._type), '{', $._expr, '}',
    ),

    // ── Trait declaration: traitName ([signatures]) ──
    trait_decl: $ => prec.dynamic(2, seq(
      field('name', $.identifier),
      '(',
      repeat($.identifier),  // supertraits
      optional($.trait_sig_body),
      ')',
    )),
    trait_sig_body: $ => seq('[', repeat($.trait_member), ']'),
    trait_member: $ => choice(
      $.trait_method_sig,
      $.associated_type,
      $.const_decl,
    ),
    trait_method_sig: $ => seq(
      field('name', $.identifier),
      $.param_list,
      optional(field('return_type', $._type)),
    ),
    associated_type: $ => seq(
      field('name', $.type_identifier),
      optional($._type),
    ),

    // ── Trait impl: traitName [Type [methods]] ──
    trait_impl: $ => prec.dynamic(1, seq(
      field('trait_name', $.identifier),
      '[', field('for_type', choice($.type_identifier, $.generic_type, $.trait_bound_type)),
      '[', repeat($.impl_member), ']',
      ']',
    )),
    impl_member: $ => choice(
      // !Name Type {value} — associated constant
      $.const_decl,
      // name(params) Type body — method with return type
      seq(
        field('name', $.identifier), $.param_list,
        optional(field('return_type', $._type)),
        optional($._method_body),
      ),
      // Name Type — associated type
      seq($.type_identifier, $._type),
    ),

    // ── Parameters ──
    param_list: $ => seq('(', repeat($.param), ')'),
    param: $ => choice(
      seq($.borrow_ref, optional($._type)),
      seq($.mutable_borrow_ref, optional($._type)),
      seq(choice($.instance_ref, $.self_ref), optional($._type)),
    ),

    // ── Method bodies ──
    _method_body: $ => choice($.computed_body, $.matching_body, $.tail_body),
    computed_body: $ => seq('[', repeat($._statement), ']'),
    matching_body: $ => seq('(|', repeat1($.match_method_arm), '|)'),
    tail_body: $ => seq('[|', repeat($._statement), '|]'),

    // ── Match method arms ──
    match_method_arm: $ => choice($.commit_arm, $.backtrack_arm, $.destructure_arm),
    commit_arm: $ => seq('(', repeat1($._arm_pattern), ')', $._expr),
    backtrack_arm: $ => seq('[', repeat1($._arm_pattern), ']', $._expr),
    destructure_arm: $ => seq(
      '[', repeat($._arm_pattern), '|', $.instance_ref, ']', $._expr,
    ),
    _arm_pattern: $ => choice(
      $.type_identifier,
      $.wildcard,
      $.instance_ref,
      $.string_literal,
      $.integer_literal,
      $.float_literal,
      seq('(', repeat1($._arm_pattern), ')'),  // nested / or-pattern
    ),

    // ── Grammar rules: <Name> { arms } ──
    grammar_rule: $ => seq(
      '<', $.type_identifier, '>',
      '{', repeat1($.grammar_arm), '}',
    ),
    grammar_arm: $ => seq(
      '[', repeat($.grammar_pattern_elem), optional(seq('|', $.instance_ref)), ']',
      $.grammar_result,
    ),
    grammar_pattern_elem: $ => choice(
      $.grammar_nonterminal,
      seq('@', choice($._upper_ident, $._lower_ident)),   // binding
      seq('"', /[^"]*/, '"'),                              // literal match
      $.type_identifier,                                    // terminal or literal
      $.identifier,                                         // terminal or literal
    ),
    grammar_nonterminal: $ => seq('<', choice($._upper_ident, $._lower_ident), '>'),
    grammar_result: $ => choice(
      seq($.type_identifier, optional(seq('(', repeat($.grammar_result_arg), ')'))),
      $.grammar_nonterminal,
      seq('@', choice($._upper_ident, $._lower_ident)),
    ),
    grammar_result_arg: $ => choice(
      seq('@', choice($._upper_ident, $._lower_ident)),
      $.grammar_nonterminal,
      seq($.type_identifier, optional(seq('(', repeat($.grammar_result_arg), ')'))),
      seq('"', /[^"]*/, '"'),
    ),

    // ── FFI: {| crate func(params) Type externName |} ──
    ffi_block: $ => seq(
      '{|', field('library', $.type_identifier),
      repeat($.ffi_function),
      '|}',
    ),
    ffi_function: $ => seq(
      field('name', $.identifier), $.param_list,
      field('return_type', $._type),
      field('extern_name', $.identifier),
    ),

    // ── Main ──
    main_block: $ => seq('Main', $.computed_body),

    // ── Type alias: Name Type ──
    type_alias: $ => prec.dynamic(-2, seq(
      field('name', $.type_identifier),
      optional(seq(token.immediate('{'), repeat1($._type), '}')),
      field('aliased', $._type),
    )),

    // ── Statements ──
    _statement: $ => choice(
      $.binding,
      $.mutable_new,
      $.mutable_set,
      $.sub_type_decl,
      $.deferred_new,
      $.return_expr,
      $.yield_expr,
      $.stdout_expr,
      $._expr,
    ),

    // @Name/new(args) or @Name Type/new(args)
    binding: $ => choice(
      // ~@Name Type/new(args) — mutable with type
      seq('~', $.instance_ref, $._type, '/', 'new', token.immediate('('), repeat($._expr), ')'),
      // @Name Type/new(args) — sub-type
      seq($.instance_ref, $._type, '/', 'new', token.immediate('('), repeat($._expr), ')'),
      // @Name/new(args) — same-type
      seq($.instance_ref, '/', 'new', token.immediate('('), repeat($._expr), ')'),
      // @Name.new(args) — deferred
      seq($.instance_ref, token.immediate('.'), 'new', token.immediate('('), repeat($._expr), ')'),
    ),

    mutable_new: $ => seq(
      '~', $.instance_ref, $._type, '/', 'new',
      token.immediate('('), repeat($._expr), ')',
    ),

    mutable_set: $ => seq(
      '~', $.instance_ref, token.immediate('.'),
      choice(
        seq('set', token.immediate('('), $._expr, ')'),
        seq('extend', token.immediate('('), $._expr, ')'),
        seq($.identifier, optional(seq(token.immediate('('), repeat($._expr), ')'))),
      ),
    ),

    sub_type_decl: $ => prec.dynamic(2, seq($.type_identifier, $._type)),
    deferred_new: $ => seq($.instance_ref, token.immediate('.'), 'new', token.immediate('('), repeat($._expr), ')'),

    return_expr: $ => prec.right(PREC.RETURN, seq('^', $._expr)),
    yield_expr: $ => prec.right(PREC.YIELD, seq('#', $._expr)),
    stdout_expr: $ => seq('StdOut', $._expr),

    // ── Expressions ──
    _expr: $ => choice(
      $._primary_expr,
      $.binary_expr,
      $.access_expr,
      $.method_call_expr,
      $.error_propagation_expr,
      $.struct_construction,
      $.type_path_variant,
      $.type_path_call,
      $.inline_eval,
      $.match_expr,
      $.range_expr,
    ),

    _primary_expr: $ => choice(
      $.instance_ref,
      $.self_ref,
      $.borrow_ref,
      $.mutable_borrow_ref,
      $.const_ref,
      $.float_literal,
      $.integer_literal,
      $.string_literal,
      $.type_identifier,
      $.identifier,
      $.stub,
      $.wildcard,
      $.paren_expr,
      $.grammar_nonterminal,
    ),

    paren_expr: $ => seq('(', $._expr, ')'),

    // ── Binary operators (precedence via rule nesting in grammar/expr.aski) ──
    binary_expr: $ => choice(
      prec.left(PREC.MULTIPLY, seq($._expr, choice('*', '/', '%'), $._expr)),
      prec.left(PREC.ADD, seq($._expr, choice('+', '-'), $._expr)),
      prec.left(PREC.COMPARE, seq($._expr, choice('<', '>', '<=', '>='), $._expr)),
      prec.left(PREC.EQUALITY, seq($._expr, choice('==', '!='), $._expr)),
      prec.left(PREC.LOGICAL_AND, seq($._expr, '&&', $._expr)),
      prec.left(PREC.LOGICAL_OR, seq($._expr, '||', $._expr)),
    ),

    // expr.field or expr.method (no call parens)
    access_expr: $ => prec.left(PREC.ACCESS, seq(
      $._expr, token.immediate('.'), choice($._upper_ident, $._lower_ident),
    )),

    // expr.method(args)
    method_call_expr: $ => prec.left(PREC.CALL, seq(
      $._expr, token.immediate('.'), choice($._lower_ident, $._upper_ident),
      token.immediate('('), repeat($._expr), ')',
    )),

    // expr?
    error_propagation_expr: $ => prec(PREC.POSTFIX, seq($._expr, token.immediate('?'))),

    // Name(Field(val) ...) — struct construction
    struct_construction: $ => prec(PREC.CALL, seq(
      $.type_identifier, token.immediate('('), repeat($.struct_construction_arg), ')',
    )),
    struct_construction_arg: $ => choice(
      seq($.type_identifier, token.immediate('('), $._expr, ')'),
      $._expr,
    ),

    // Name/Variant — type path variant access
    type_path_variant: $ => prec(PREC.CALL, seq(
      $.type_identifier, '/', $.type_identifier,
    )),

    // Name/method(args) — type path method call
    type_path_call: $ => prec(PREC.CALL, seq(
      $.type_identifier, '/', $.identifier,
      token.immediate('('), repeat($._expr), ')',
    )),

    // [stmts] — inline eval
    inline_eval: $ => seq('[', repeat1($._statement), ']'),

    // (| target arms |) — match expression
    match_expr: $ => seq('(|', repeat($._match_content), '|)'),
    _match_content: $ => choice($.match_arm, $._expr),
    match_arm: $ => seq(
      '(', repeat1($._arm_pattern), ')', $._expr,
    ),

    // start..end or start..=end
    range_expr: $ => prec.left(PREC.COMPARE, choice(
      seq($._expr, '..', $._expr),
      seq($._expr, '..=', $._expr),
    )),
  },
});
