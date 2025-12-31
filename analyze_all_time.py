import pandas as pd

# Read CSV and convert Total Price from string to float
csv = pd.read_csv(r'C:\Projects\KanvaPortal\docs\all_time_review_file.csv')
csv['Total Price'] = csv['Total Price'].str.replace('$', '').str.replace(',', '').astype(float)

print('=== ALL TIME REVIEW FILE ANALYSIS ===\n')
print('Total rows:', len(csv))
print('Columns:', list(csv.columns)[:15])

print('\n=== SALES PERSON BREAKDOWN ===')
print('Unique sales persons:', csv['Sales person'].unique())
print('Counts by sales person:')
print(csv['Sales person'].value_counts())

print('\n=== DECEMBER 2025 DATA ===')
dec = csv[csv['Year-month'] == 'December 2025']
print('December 2025 rows:', len(dec))
print('Unique orders:', dec['Sales order Number'].nunique())
print('Total revenue: $', dec['Total Price'].sum())

print('\nDecember 2025 by sales person:')
dec_by_rep = dec.groupby('Sales person').agg({'Total Price': 'sum'}).sort_values('Total Price', ascending=False)
for rep in dec_by_rep.index:
    revenue = dec_by_rep.loc[rep, 'Total Price']
    print(f'  {rep}: ${revenue:,.2f}')

print('\n=== ORDER 9715 CHECK ===')
has_9715 = 9715 in csv['Sales order Number'].values
print('Has order 9715:', has_9715)

if has_9715:
    order_9715 = csv[csv['Sales order Number'] == 9715]
    print('Order 9715 rows:', len(order_9715))
    print('Order 9715 revenue:', order_9715['Total Price'].sum())
    print('Order 9715 Issued dates:', order_9715['Issued date'].unique())
    print('Order 9715 Year-month:', order_9715['Year-month'].unique())
    print('Order 9715 sales person:', order_9715['Sales person'].unique())
    print('\nOrder 9715 line items:')
    print(order_9715[['Issued date', 'Year-month', 'Sales person', 'Product', 'Total Price']])

print('\n=== DATE FORMAT CHECK ===')
print('Sample Issued dates from December 2025:')
print(dec['Issued date'].value_counts().head(10))

print('\n=== EXPECTED vs ACTUAL ===')
print('Expected December 2025:')
print('  Total: $1,432,298.73')
print('  BenW: $291,879.50')
print('  Zalak: $393,355.20')
print('  DerekW: $318,966.95')
print('  BrandonG: $267,930.38')
print('  Jared: $160,166.70')

print('\nActual from this file:')
print(f'  Total: ${dec["Total Price"].sum():,.2f}')
for rep in dec_by_rep.index:
    revenue = float(dec_by_rep.loc[rep, 'Total Price'])
    print(f'  {rep}: ${revenue:,.2f}')

print('\n=== VERDICT ===')
if dec['Total Price'].sum() == 1432298.73:
    print('✅ FILE IS COMPLETE - Revenue matches expected $1,432,298.73')
    print('✅ GO FOR IMPORT')
elif dec['Total Price'].sum() == 1416226.73:
    print('⚠️  FILE IS MISSING ORDER 9715 - Revenue is $1,416,226.73 (short $16,072)')
    print('❌ DO NOT IMPORT - Get complete file')
else:
    print(f'⚠️  UNEXPECTED REVENUE: ${dec["Total Price"].sum():,.2f}')
    print('❌ REVIEW REQUIRED')
