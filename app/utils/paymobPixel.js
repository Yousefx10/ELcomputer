// Only implemented card capability reaches Pixel. Express slots await merchant/browser validation.
export const pixelPaymentMethods = capabilities => capabilities?.card?.available === true ? ['card'] : []
export const paymobPixelOptions = ({ publicKey, clientSecret, elementId, locale, dark, afterPaymentComplete, onPaymentCancel }) => ({
  publicKey, clientSecret, elementId, paymentMethods: ['card'],
  showSaveCard: false, forceSaveCard: false, showPaymobLogo: true,
  afterPaymentComplete, onPaymentCancel,
  customStyle: {
    Direction: locale === 'ar' ? 'rtl' : 'ltr', Width_of_Container: '100%', Container_Padding: '0',
    Font_Family: 'inherit', Font_Size_Input_Fields: '16', Font_Size_Label: '14', Radius_Border: '12',
    Color_Primary: '#2563eb', Color_Container: dark ? '#0f172a' : '#ffffff',
    Color_Input_Fields: dark ? '#1e293b' : '#ffffff', Color_Border_Input_Fields: dark ? '#475569' : '#cbd5e1',
    Text_Color_For_Label: dark ? '#f1f5f9' : '#0f172a', Text_Color_For_Input_Fields: dark ? '#f1f5f9' : '#0f172a',
    Text_Color_For_Payment_Button: '#ffffff', Color_Error: dark ? '#fca5a5' : '#b91c1c',
    ...(locale === 'ar' ? {
      Label_Text: { cardLabel: 'بيانات البطاقة' },
      Placeholder_Text: { holderName: 'الاسم على البطاقة', cardNumber: 'رقم البطاقة', expiryDate: 'شهر / سنة', securityCode: 'رمز الأمان (CVV)' },
      Error_Text: { cardNumber: { required: 'رقم البطاقة مطلوب', invalid: 'رقم البطاقة غير صحيح' }, expiryDate: { required: 'تاريخ الانتهاء مطلوب', invalid: 'تاريخ الانتهاء غير صحيح' }, securityCode: 'رمز الأمان مطلوب', holderName: 'اسم حامل البطاقة مطلوب' },
      Button_Text: { payBtn: 'ادفع' }
    } : {})
  }
})
