/**
 * Generate quizzes for Business Studies Form Two course
 * 5 chapters × 5 quizzes each = 25 quizzes total
 */

const quizzes = {
  course: {
    code: 'BS-F2',
    title: 'Business Studies Form Two',
    description: 'Business Studies curriculum for Form Two secondary students in Tanzania',
    difficulty_level: 'intermediate'
  },

  chapters: [
    {
      chapter_number: 1,
      title: 'Production',
      description: 'Understanding the concept and factors of production',
      quizzes: [
        {
          title: 'The Concept of Production',
          questions: [
            {
              question: 'What is production?',
              options: [
                'The process of extracting and transforming inputs into outputs',
                'Only manufacturing goods in factories',
                'Buying and selling products',
                'Storing finished products'
              ],
              correct_answer: 0,
              explanation: 'Production is the process of extracting and transforming inputs (raw materials) into outputs (finished products) to satisfy human needs and wants.'
            },
            {
              question: 'Which of the following is an example of direct production?',
              options: [
                'A tailor making clothes for sale',
                'A farmer growing vegetables for personal consumption',
                'A chef cooking meals for a restaurant',
                'A carpenter making furniture for customers'
              ],
              correct_answer: 1,
              explanation: 'Direct production is creating goods and services for personal consumption. The farmer growing vegetables for personal use is direct production.'
            },
            {
              question: 'What is indirect production?',
              options: [
                'Production for personal use only',
                'Production of goods and services for selling',
                'Production without using any tools',
                'Production that does not create value'
              ],
              correct_answer: 1,
              explanation: 'Indirect production refers to producing goods and services for selling to earn money, such as a tailor designing clothes for sale.'
            },
            {
              question: 'Why is production important for the economy?',
              options: [
                'It only helps individual businesses',
                'It creates jobs, improves living standards, and increases government revenue',
                'It reduces the need for imports only',
                'It eliminates all business risks'
              ],
              correct_answer: 1,
              explanation: 'Production is important because it creates employment, improves living standards, generates tax revenue for the government, and boosts economic development.'
            },
            {
              question: 'Which statement about production is TRUE?',
              options: [
                'Production only involves manufacturing physical goods',
                'Production must always use modern technology',
                'Production transforms raw materials into finished products to satisfy human needs',
                'Production does not require any factors of production'
              ],
              correct_answer: 2,
              explanation: 'Production involves transforming raw materials into finished products (goods) or providing services to satisfy human needs and wants.'
            }
          ]
        },
        {
          title: 'Factors of Production - Land',
          questions: [
            {
              question: 'What does "land" as a factor of production include?',
              options: [
                'Only the surface of the earth',
                'All natural resources including water, soil, minerals, and trees',
                'Only agricultural land',
                'Man-made buildings and structures'
              ],
              correct_answer: 1,
              explanation: 'Land refers to all natural resources made available by nature, including water, soil, minerals, trees, and everything on, under, and above the ground.'
            },
            {
              question: 'Which is a feature of land as a factor of production?',
              options: [
                'It can be easily moved from one location to another',
                'It is manufactured by humans',
                'It is fixed in supply and cannot be increased or decreased',
                'Its value decreases over time'
              ],
              correct_answer: 2,
              explanation: 'Land is fixed in supply, meaning the total amount available cannot be increased or decreased. It is a gift of nature.'
            },
            {
              question: 'What is the reward for land as a factor of production?',
              options: [
                'Wages',
                'Interest',
                'Rent',
                'Profit'
              ],
              correct_answer: 2,
              explanation: 'The payment for land use is known as rent. Land owners receive rent when others use their land for production activities.'
            },
            {
              question: 'Which characteristic describes land?',
              options: [
                'It has high mobility',
                'It depreciates quickly',
                'It appreciates in value over time',
                'It can be stored for future use'
              ],
              correct_answer: 2,
              explanation: 'Land appreciates, meaning it increases in value as time goes on, unlike many other assets that depreciate.'
            },
            {
              question: 'Why is land considered a fundamental factor of production?',
              options: [
                'It is the cheapest factor to obtain',
                'All production activities take place on it',
                'It never requires any maintenance',
                'It can be easily replaced'
              ],
              correct_answer: 1,
              explanation: 'Land is fundamental because all production activities such as transportation, trade, and manufacturing take place on it.'
            }
          ]
        },
        {
          title: 'Factors of Production - Labour',
          questions: [
            {
              question: 'What is labour as a factor of production?',
              options: [
                'Only physical work done by humans',
                'Any mental or physical effort used in production',
                'Work done by machines only',
                'Unpaid volunteer work'
              ],
              correct_answer: 1,
              explanation: 'Labour refers to any mental or physical effort a human uses in production to produce goods and services that satisfy human needs and wants.'
            },
            {
              question: 'Which type of labour requires the most education and training?',
              options: [
                'Unskilled labour',
                'Semi-skilled labour',
                'Skilled labour',
                'All types require equal training'
              ],
              correct_answer: 2,
              explanation: 'Skilled labour includes workers who use more mental than physical efforts and are educated, trained, and experienced, such as accountants, lawyers, and doctors.'
            },
            {
              question: 'What is the reward for labour?',
              options: [
                'Rent',
                'Wages or salary',
                'Interest',
                'Profit'
              ],
              correct_answer: 1,
              explanation: 'The reward for labour is a wage or salary paid to workers for their contribution to production.'
            },
            {
              question: 'Which is an example of semi-skilled labour?',
              options: [
                'A university professor',
                'A hotel attendant',
                'A farm worker',
                'A janitor'
              ],
              correct_answer: 1,
              explanation: 'Semi-skilled labour includes workers who use both mental and physical efforts with less advanced education, such as hotel attendants, bus drivers, and machine operators.'
            },
            {
              question: 'What is a feature of labour as a factor of production?',
              options: [
                'Labour cannot be separated from the labourer',
                'Labour can be stored for future use',
                'Labour does not require any skills',
                'Labour is the least mobile factor'
              ],
              correct_answer: 0,
              explanation: 'A key feature of labour is that it cannot be separated from the labourer - the worker must be present to perform the work.'
            }
          ]
        },
        {
          title: 'Factors of Production - Capital',
          questions: [
            {
              question: 'What is capital in production?',
              options: [
                'Only money in the bank',
                'All man-made resources used to produce goods and services',
                'Natural resources from the environment',
                'Human skills and knowledge only'
              ],
              correct_answer: 1,
              explanation: 'Capital refers to all man-made resources used to produce goods and services, including buildings, tools, machines, and cash.'
            },
            {
              question: 'What is the reward for capital?',
              options: [
                'Wages',
                'Rent',
                'Interest',
                'Commission'
              ],
              correct_answer: 2,
              explanation: 'The reward for capital is interest. Those who provide capital for business operations receive interest as payment.'
            },
            {
              question: 'Which feature describes capital?',
              options: [
                'It occurs naturally in the environment',
                'It is artificial and generated by humans',
                'It cannot depreciate',
                'It is completely immobile'
              ],
              correct_answer: 1,
              explanation: 'Capital is artificial, meaning it does not occur naturally but is generated or created by humans through savings, loans, or investments.'
            },
            {
              question: 'What does it mean that capital can depreciate?',
              options: [
                'Its value increases over time',
                'Its value stays constant',
                'Its value can decrease over time',
                'It never loses value'
              ],
              correct_answer: 2,
              explanation: 'Capital can depreciate, meaning its value can decrease over time due to wear and tear, obsolescence, or other factors.'
            },
            {
              question: 'Which of these is an example of capital?',
              options: [
                'A worker\'s skills',
                'Agricultural land',
                'A factory building',
                'An entrepreneur\'s idea'
              ],
              correct_answer: 2,
              explanation: 'A factory building is an example of capital - it is a man-made resource (building) used to produce goods and services.'
            }
          ]
        },
        {
          title: 'Factors of Production - Entrepreneurship',
          questions: [
            {
              question: 'What is entrepreneurship?',
              options: [
                'The process of working for someone else',
                'The process of identifying opportunities and organizing factors of production',
                'Only investing money in a business',
                'Managing a business owned by others'
              ],
              correct_answer: 1,
              explanation: 'Entrepreneurship is the process of identifying a business opportunity and organizing other factors of production (land, labour, capital) to produce a product or service.'
            },
            {
              question: 'What is the reward for entrepreneurship?',
              options: [
                'Wages',
                'Interest',
                'Rent',
                'Profit'
              ],
              correct_answer: 3,
              explanation: 'The reward for entrepreneurship is profit. Entrepreneurs take risks and the profit is their compensation for organizing and managing the business.'
            },
            {
              question: 'Which ability is essential for entrepreneurs?',
              options: [
                'Following instructions exactly',
                'Avoiding all business risks',
                'Planning, organizing, managing, and bearing risks',
                'Working only with familiar ideas'
              ],
              correct_answer: 2,
              explanation: 'Entrepreneurs need the ability to plan, organize, manage, allocate resources, define objectives, bear risks, and innovate with modern production techniques.'
            },
            {
              question: 'How does entrepreneurship combine other factors of production?',
              options: [
                'It replaces the need for land, labour, and capital',
                'It organizes and controls land, labour, and capital',
                'It only provides financial resources',
                'It eliminates the need for other factors'
              ],
              correct_answer: 1,
              explanation: 'Entrepreneurship combines, organizes, and controls the other three factors of production (land, labour, and capital) to create products or services.'
            },
            {
              question: 'Why is entrepreneurship important for production?',
              options: [
                'It guarantees business success',
                'It eliminates all risks in business',
                'It organizes all factors of production and makes business decisions',
                'It provides unlimited financial resources'
              ],
              correct_answer: 2,
              explanation: 'Entrepreneurship is crucial because the entrepreneur organizes all other factors of production and makes decisions to ensure business success, while bearing the risks.'
            }
          ]
        }
      ]
    },
    {
      chapter_number: 2,
      title: 'Financing Small-Sized Businesses',
      description: 'Understanding sources of funds for small businesses',
      quizzes: [
        {
          title: 'Concept of Small-Sized Businesses',
          questions: [
            {
              question: 'According to Tanzania\'s SME Development Policy of 2003, what defines a micro business?',
              options: [
                'Employs 1-4 people and/or capital up to TShs 5 million',
                'Employs 5-49 people and capital TShs 5-200 million',
                'Employs 50+ people',
                'Any business with less than 10 employees'
              ],
              correct_answer: 0,
              explanation: 'A micro business employs 1-4 people and/or has a capital investment of up to TShs 5 million according to Tanzania\'s SME policy.'
            },
            {
              question: 'What defines a small business in Tanzania?',
              options: [
                'Employs 1-4 people',
                'Employs 5-49 people and/or capital above TShs 5 million to 200 million',
                'Employs more than 50 people',
                'Any family-owned business'
              ],
              correct_answer: 1,
              explanation: 'A small business has 5-49 employees and/or a capital investment above TShs 5 million to 200 million.'
            },
            {
              question: 'Why are small-sized businesses important?',
              options: [
                'They only benefit business owners',
                'They contribute to economic growth, create employment, and foster equitable income distribution',
                'They replace large businesses',
                'They require no management skills'
              ],
              correct_answer: 1,
              explanation: 'Small businesses contribute to the economy, create employment, foster equitable income distribution, support community development, and supply goods to remote areas.'
            },
            {
              question: 'What is one way small businesses support the economy?',
              options: [
                'They eliminate all competition',
                'They provide tax revenue and create jobs',
                'They only serve wealthy customers',
                'They require no capital investment'
              ],
              correct_answer: 1,
              explanation: 'Small businesses contribute to the economy by paying taxes and fees, creating employment opportunities, and reducing unemployment rates.'
            },
            {
              question: 'Which statement about small businesses is TRUE?',
              options: [
                'They can only be owned by individuals',
                'They may be owned by individuals, groups, families, or the public',
                'They never require any employees',
                'They must always have more than 10 employees'
              ],
              correct_answer: 1,
              explanation: 'Small-sized businesses may be owned by individuals, groups of individuals, family members, or the public with a common interest in achieving predetermined goals.'
            }
          ]
        },
        {
          title: 'Loans as a Source of Funding',
          questions: [
            {
              question: 'What is a loan?',
              options: [
                'Free money from the government',
                'Money borrowed from a lender/bank with agreement to repay with interest',
                'A gift from family members',
                'Money that never needs to be repaid'
              ],
              correct_answer: 1,
              explanation: 'A loan is money borrowed from a lender or bank with the agreement to repay it, usually with interest over an agreed time.'
            },
            {
              question: 'What is an advantage of taking a loan?',
              options: [
                'Loans are always interest-free',
                'Loans provide availability of funds to start or expand a business',
                'Loans never need to be repaid',
                'Loans have no conditions'
              ],
              correct_answer: 1,
              explanation: 'Loans allow business owners to access a lump sum of money to start or expand a business, providing investment opportunities.'
            },
            {
              question: 'What is a disadvantage of loans?',
              options: [
                'They provide too much money',
                'High interest rates which may hinder business growth',
                'They are too easy to obtain',
                'They require no documentation'
              ],
              correct_answer: 1,
              explanation: 'Lenders tend to charge high interest rates, which may hinder the business owner\'s access to loans and increase the cost of borrowing.'
            },
            {
              question: 'What does "credit building" mean regarding loans?',
              options: [
                'Building physical structures',
                'Responsible borrowing and timely repayment helps build good credit scores',
                'Avoiding all loans',
                'Borrowing as much as possible'
              ],
              correct_answer: 1,
              explanation: 'Responsible borrowing and timely repayment of loans can help business owners build their credit scores, which can be significant for future financial opportunities.'
            },
            {
              question: 'Why might someone fail to get a loan?',
              options: [
                'They have too much money',
                'They don\'t meet eligibility requirements like needing collateral',
                'They own a successful business',
                'They have excellent credit history'
              ],
              correct_answer: 1,
              explanation: 'Borrowers must meet all given conditions and requirements, including collateral, to qualify for loans, whereas others may miss some qualifications and fail to access them.'
            }
          ]
        },
        {
          title: 'Personal Savings',
          questions: [
            {
              question: 'What are personal savings?',
              options: [
                'Money borrowed from banks',
                'Setting aside part of income for future usage instead of spending all of it',
                'Government grants',
                'Money from business profits only'
              ],
              correct_answer: 1,
              explanation: 'Personal savings refers to setting aside part of an individual\'s income or earnings for future usage instead of spending all of it.'
            },
            {
              question: 'Why are savings important for starting a business?',
              options: [
                'Savings guarantee business success',
                'Saved money can be used as capital to set up or improve a small business',
                'Savings eliminate all business risks',
                'They are only useful for large businesses'
              ],
              correct_answer: 1,
              explanation: 'Developing a saving habit means the little money saved later becomes huge and can be used to set up a small business as capital.'
            },
            {
              question: 'What is an advantage of using personal savings for business?',
              options: [
                'It creates debt obligations',
                'It provides flexibility and avoids taking on loans (no debt)',
                'It requires paying interest',
                'It needs collateral'
              ],
              correct_answer: 1,
              explanation: 'By funding business with personal savings, owners avoid taking on loans, which can be crucial for minimizing financial obligations and having flexibility in fund usage.'
            },
            {
              question: 'What is a disadvantage of personal savings?',
              options: [
                'Savings are too easy to access',
                'Interest rates on savings accounts are often very low',
                'Savings grow too quickly',
                'Savings require no discipline'
              ],
              correct_answer: 1,
              explanation: 'Interest rates on savings accounts and other passive investments are often very low, meaning savings income may not keep pace with inflation.'
            },
            {
              question: 'What risk exists when using personal savings for business?',
              options: [
                'Savings grow too fast',
                'Using personal savings puts personal financial stability at risk',
                'Banks will reject the savings',
                'Savings cannot be withdrawn'
              ],
              correct_answer: 1,
              explanation: 'Using personal savings for business funding puts personal financial stability at risk. Entrepreneurs\' assets and savings could be jeopardized if the business fails.'
            }
          ]
        },
        {
          title: 'Deferred Payment',
          questions: [
            {
              question: 'What is deferred payment?',
              options: [
                'Paying immediately with cash',
                'An agreement where buyer pays for goods/services later',
                'Never paying for goods',
                'A type of loan from banks'
              ],
              correct_answer: 1,
              explanation: 'Deferred payment is an agreement between buyer and seller in which the buyer can pay for goods and services later.'
            },
            {
              question: 'How can deferred payment help business owners?',
              options: [
                'It eliminates all business costs',
                'Owners can obtain materials for starting or expanding without immediate payment',
                'It provides free goods',
                'It removes the need for suppliers'
              ],
              correct_answer: 1,
              explanation: 'Business owners can use deferred payment to obtain materials for starting or expanding their businesses, then pay suppliers after selling products to customers.'
            },
            {
              question: 'What is an advantage of deferred payment for buyers?',
              options: [
                'Goods become free',
                'It allows cash flow management by delaying payment until later',
                'Interest is never charged',
                'No payment is ever required'
              ],
              correct_answer: 1,
              explanation: 'Deferred payments allow buyers to manage their cash flow by delaying payment for goods or services until later, benefiting those with fluctuating incomes.'
            },
            {
              question: 'What is a disadvantage of deferred payment for buyers?',
              options: [
                'It provides too much flexibility',
                'It can incur added interest, increasing the overall cost',
                'It\'s too easy to arrange',
                'Suppliers always offer discounts'
              ],
              correct_answer: 1,
              explanation: 'Deferred payment can incur added interest, increasing the purchased products\' overall cost over time.'
            },
            {
              question: 'What risk do sellers face with deferred payment?',
              options: [
                'Customers pay too quickly',
                'Risk of non-payment when buyers fail to pay',
                'Too many sales',
                'No administrative work'
              ],
              correct_answer: 1,
              explanation: 'Sellers face non-payment risk when allowing buyers to defer payments, which could potentially lead to financial loss.'
            }
          ]
        },
        {
          title: 'Funds from Family and Friends & Microfinancing',
          questions: [
            {
              question: 'What are funds from family and friends?',
              options: [
                'Bank loans with high interest',
                'Financial contributions in the form of equity or loans from people close to the business owner',
                'Government grants',
                'International aid'
              ],
              correct_answer: 1,
              explanation: 'Funds from family and friends are financial contributions from people close to the business owner in the form of equity investments or loans, sometimes without interest.'
            },
            {
              question: 'What is an advantage of funds from family and friends?',
              options: [
                'They always come with strict contracts',
                'They offer flexibility with more favorable conditions than formal lenders',
                'They require collateral',
                'They have higher interest than banks'
              ],
              correct_answer: 1,
              explanation: 'Friends and family members may offer more favorable conditions, such as lower interest rates and extended repayment schedules, than formal lenders.'
            },
            {
              question: 'What is a disadvantage of receiving funds from family?',
              options: [
                'Too much accountability required',
                'May result in personal conflicts, especially if business underperforms',
                'Interest rates are too high',
                'Too difficult to access'
              ],
              correct_answer: 1,
              explanation: 'Receiving money from family and friends may result in personal conflicts, especially when the business is underperforming and one fails to repay the money.'
            },
            {
              question: 'What is microfinancing?',
              options: [
                'Large loans for big corporations',
                'Financial services offered to low-income individuals/small businesses without access to traditional banking',
                'Free government grants',
                'International charity donations'
              ],
              correct_answer: 1,
              explanation: 'Microfinancing refers to financial services offered to low-income individuals, groups, or small businesses that may not have access to conventional banking services.'
            },
            {
              question: 'How do cooperatives help small businesses?',
              options: [
                'They eliminate all business risks',
                'They provide training, pooled resources, and market access',
                'They give free money',
                'They replace the need for business planning'
              ],
              correct_answer: 1,
              explanation: 'Cooperatives provide training opportunities, support services, allow members to pool resources for purchasing or marketing, and provide access to markets that businesses might struggle to reach independently.'
            }
          ]
        }
      ]
    },
    {
      chapter_number: 3,
      title: 'Small Business Management',
      description: 'Financial record-keeping, profit/loss calculation, budgeting, and administration',
      quizzes: [
        {
          title: 'Concept of Small Business Management',
          questions: [
            {
              question: 'What is management in a business context?',
              options: [
                'Only supervising employees',
                'Administration of operations using effective methods to achieve goals',
                'Just making financial decisions',
                'Handling customer complaints only'
              ],
              correct_answer: 1,
              explanation: 'Management is the administration of an organization\'s operations using various effective and efficient methods to achieve its goals through planning, leading, and controlling resources.'
            },
            {
              question: 'What does managing a small business involve?',
              options: [
                'Only hiring employees',
                'Monitoring all matters related to business activities including decision-making and problem-solving',
                'Just tracking sales',
                'Only managing finances'
              ],
              correct_answer: 1,
              explanation: 'Managing a small business means monitoring all matters related to business activities, including streamlining aspects such as decision-making, problem-solving, and staff management.'
            },
            {
              question: 'Which is a function of business management?',
              options: [
                'Avoiding all planning activities',
                'Planning - determining the course of action the business will take',
                'Ignoring employee performance',
                'Eliminating all business controls'
              ],
              correct_answer: 1,
              explanation: 'Planning is a key management function that involves determining the course of action the business will take to achieve its goals through thinking and forecasting processes.'
            },
            {
              question: 'What is the staffing function in management?',
              options: [
                'Firing all employees regularly',
                'Finding the right people with right qualifications for the right job',
                'Avoiding human resource management',
                'Hiring anyone available'
              ],
              correct_answer: 1,
              explanation: 'Staffing is finding the right people with the right qualifications for the right job, involving recruiting, selecting, placing, training, and retiring personnel.'
            },
            {
              question: 'Why is the controlling function important?',
              options: [
                'To micromanage every detail',
                'To monitor, compare, and correct work performed to achieve business goals',
                'To punish employees',
                'To eliminate all creativity'
              ],
              correct_answer: 1,
              explanation: 'Controlling involves monitoring, comparing, and correcting work performed. It links the planning process and enables businesses to monitor and assess activities to achieve business goals.'
            }
          ]
        },
        {
          title: 'Financial Record-Keeping - Cash Book',
          questions: [
            {
              question: 'What is a cash book?',
              options: [
                'A book for writing stories',
                'A financial book that records all cash transactions related to purchases and sales',
                'A notebook for personal expenses',
                'A book for employee attendance'
              ],
              correct_answer: 1,
              explanation: 'A cash book is a financial book that records all cash transactions related to purchases and sales in a business. It is a diary of money for business owners.'
            },
            {
              question: 'What should be recorded on the left side of a cash book?',
              options: [
                'Cash payments (expenses)',
                'Cash receipts (income)',
                'Employee names',
                'Product descriptions'
              ],
              correct_answer: 1,
              explanation: 'The left-hand side of a cash book records cash receipts (money received), while the right-hand side records cash payments (money spent).'
            },
            {
              question: 'Why is a cash book important?',
              options: [
                'It\'s required by law only',
                'It helps track business daily cash flow and enables financial planning',
                'It replaces the need for a business plan',
                'It\'s only useful for large businesses'
              ],
              correct_answer: 1,
              explanation: 'A cash book helps track the business\'s daily cash flow, enables the business owner to develop a financial plan and budget, and helps detect errors.'
            },
            {
              question: 'What is the "opening balance" in a cash book?',
              options: [
                'The amount owed to suppliers',
                'The amount of cash available at the start of a period',
                'The total sales for the month',
                'The profit made'
              ],
              correct_answer: 1,
              explanation: 'The opening balance is the amount of cash the business has at the beginning of the accounting period.'
            },
            {
              question: 'What is the "closing balance" in a cash book?',
              options: [
                'The amount spent on inventory',
                'The amount of cash remaining at the end of a period',
                'The total expenses',
                'The initial investment'
              ],
              correct_answer: 1,
              explanation: 'The closing balance is the amount of cash remaining at the end of the period after recording all receipts and payments.'
            }
          ]
        },
        {
          title: 'Sales and Purchases Day Books',
          questions: [
            {
              question: 'What is a sales day book?',
              options: [
                'A book for recording employee schedules',
                'A financial book that records all sales transactions made on credit',
                'A book for listing products',
                'A customer contact directory'
              ],
              correct_answer: 1,
              explanation: 'A sales day book is a financial book that records all sales transactions made on credit in a business, helping track business credit sales.'
            },
            {
              question: 'Why is a sales day book important?',
              options: [
                'It replaces cash receipts',
                'It helps keep track of the business\'s credit sales and customer debts',
                'It\'s only for decoration',
                'It eliminates the need for invoices'
              ],
              correct_answer: 1,
              explanation: 'A sales day book helps the business owner keep track of the business\'s credit sales, showing which customers owe money and how much.'
            },
            {
              question: 'What is a purchases day book?',
              options: [
                'A book for employee purchases',
                'A financial book that records purchases on credit',
                'A shopping list',
                'A supplier contact list'
              ],
              correct_answer: 1,
              explanation: 'A purchases day book is a financial book that records every good bought from a supplier without cash payment (purchases on credit).'
            },
            {
              question: 'What information is typically recorded in a sales day book?',
              options: [
                'Only customer names',
                'Date, particulars, description of goods sold on credit, and amount',
                'Just the total amount',
                'Only product names'
              ],
              correct_answer: 1,
              explanation: 'A sales day book typically records the date, customer name (particulars), description of goods sold, and the amount for each credit sale.'
            },
            {
              question: 'How do purchases day books help small businesses?',
              options: [
                'They eliminate the need for suppliers',
                'They enable tracking of credit purchases and amounts owed to suppliers',
                'They guarantee payment discounts',
                'They replace cash books entirely'
              ],
              correct_answer: 1,
              explanation: 'Purchases day books enable small business owners to keep track of their business\'s credit purchases and monitor what they owe suppliers.'
            }
          ]
        },
        {
          title: 'Profit and Loss Calculation',
          questions: [
            {
              question: 'What is profit?',
              options: [
                'The total amount of sales',
                'When a business makes more money from selling than it spends on running it',
                'The amount invested in the business',
                'The total expenses of the business'
              ],
              correct_answer: 1,
              explanation: 'Profit happens when a business makes more money from selling its products than it spends on running it. Income is higher than expenditures.'
            },
            {
              question: 'What is a loss?',
              options: [
                'When sales equal expenses',
                'When a business spends more money than it earns',
                'The cost of goods sold',
                'The total revenue'
              ],
              correct_answer: 1,
              explanation: 'Loss occurs when a business spends more money than it earns. The expenditures are higher than the income.'
            },
            {
              question: 'How do you calculate profit or loss?',
              options: [
                'Add total income and total expenses',
                'Subtract total expenses from total income',
                'Multiply income by expenses',
                'Divide expenses by income'
              ],
              correct_answer: 1,
              explanation: 'To calculate profit or loss, subtract the total expenses from the total income. If positive, it\'s profit; if negative, it\'s a loss.'
            },
            {
              question: 'What is an income statement?',
              options: [
                'A list of business assets',
                'A financial statement showing income, expenditures, and profit or loss over a period',
                'A customer invoice',
                'An employee salary slip'
              ],
              correct_answer: 1,
              explanation: 'An income statement shows a business\'s income, expenditures, and overall profit or loss over a specific period, helping assess financial performance.'
            },
            {
              question: 'Why is knowing profit and loss helpful?',
              options: [
                'It\'s required by competitors',
                'It helps assess business performance and decide whether to reinvest, improve, or stop',
                'It eliminates business risks',
                'It guarantees future profits'
              ],
              correct_answer: 1,
              explanation: 'Knowing profit and loss helps assess business financial performance and decide whether to reinvest profits for growth, make improvements, or even stop unprofitable projects.'
            }
          ]
        },
        {
          title: 'Budgeting, Control and Administration',
          questions: [
            {
              question: 'What is budgeting?',
              options: [
                'Spending money freely',
                'Preparing a plan for managing money for a particular time',
                'Only tracking expenses',
                'Ignoring financial planning'
              ],
              correct_answer: 1,
              explanation: 'Budgeting involves preparing a plan for managing money for a particular time, allocating funds to meet various expenditures and savings.'
            },
            {
              question: 'Why is budgeting important for small businesses?',
              options: [
                'It guarantees profits',
                'It helps control spending, set financial goals, and make informed decisions',
                'It eliminates all expenses',
                'It\'s only useful for large companies'
              ],
              correct_answer: 1,
              explanation: 'Budgeting helps businesses control spending, set financial goals, make informed decisions, and maintain stable financial footing for sustainable growth.'
            },
            {
              question: 'According to wise spending principles, what percentage of profit should go to needs?',
              options: [
                '20%',
                '30%',
                '40%',
                '50%'
              ],
              correct_answer: 2,
              explanation: 'The 40-20-30-10 rule suggests that 40% of net profit should go to needs (essential expenses like rent, salaries, taxes, utilities).'
            },
            {
              question: 'What is "control" in business management?',
              options: [
                'Micromanaging everything',
                'Sticking to the plan and checking prices before buying to avoid overspending',
                'Avoiding all purchases',
                'Ignoring the budget'
              ],
              correct_answer: 1,
              explanation: 'Control means sticking to the plan and checking prices before buying things to avoid spending too much, ensuring financial discipline.'
            },
            {
              question: 'What is administration in business?',
              options: [
                'Only hiring employees',
                'Keeping track of everything - writing down purchases, costs, and remaining money',
                'Ignoring financial records',
                'Just managing offices'
              ],
              correct_answer: 1,
              explanation: 'Administration is keeping track of everything, writing down what the business has bought, costs, and money left, helping stay organized and on track.'
            }
          ]
        }
      ]
    },
    {
      chapter_number: 4,
      title: 'Warehousing and Inventorying for Small Businesses',
      description: 'Understanding warehousing concepts, inventory management, and essential documents',
      quizzes: [
        {
          title: 'The Concept of Warehousing',
          questions: [
            {
              question: 'What is warehousing?',
              options: [
                'Only building storage structures',
                'Activities involving receiving, storing, and preparing goods for shipment or distribution',
                'Just buying products',
                'Selling goods directly to customers'
              ],
              correct_answer: 1,
              explanation: 'Warehousing is a set of activities that involves receiving, storing, and preparing goods for shipment or distribution to traders and customers.'
            },
            {
              question: 'What is a warehouse?',
              options: [
                'Any retail store',
                'A building that stores products (raw materials, semi-finished, and finished goods) for future use or sale',
                'A customer service center',
                'An office building'
              ],
              correct_answer: 1,
              explanation: 'A warehouse is a building that stores products such as raw materials, semi-finished and finished goods for future use or sale.'
            },
            {
              question: 'Why is warehousing crucial for small businesses?',
              options: [
                'It eliminates the need for products',
                'It ensures goods are sufficient to prevent customer disappointments and prevents spoilage',
                'It increases product costs',
                'It replaces the need for sales'
              ],
              correct_answer: 1,
              explanation: 'Warehousing ensures goods are sufficient to prevent customer disappointments, properly prevents products from spoilage or damage, and ensures smooth stock tracking.'
            },
            {
              question: 'What is a merit of warehousing?',
              options: [
                'It increases product spoilage',
                'It enables regular flow of goods and ensures reliable supply over time',
                'It makes products more expensive',
                'It reduces product quality'
              ],
              correct_answer: 1,
              explanation: 'Warehouses enable efficient product distribution in the market and ensure a reliable supply of particular products over time, especially for seasonal goods.'
            },
            {
              question: 'What is a demerit of warehousing?',
              options: [
                'Products are too well protected',
                'It requires substantial initial capital investment',
                'It makes products too accessible',
                'It speeds up production too much'
              ],
              correct_answer: 1,
              explanation: 'Warehouses require substantial initial capital investment. Because costs are incredibly high, small-scale businesses with limited capital may be unable to construct and operate them.'
            }
          ]
        },
        {
          title: 'Types of Warehouses',
          questions: [
            {
              question: 'What is a private warehouse?',
              options: [
                'A warehouse open to the public',
                'A warehouse owned and managed by individuals or companies to store their goods',
                'A government-owned storage facility',
                'A temporary storage space'
              ],
              correct_answer: 1,
              explanation: 'Private warehouses are owned and managed by individuals or companies to store their goods at a selected location. Small businesses can build, lease, or purchase one.'
            },
            {
              question: 'What is a public warehouse?',
              options: [
                'Only for government use',
                'Owned by government or companies but open to any public member to store products for a fee',
                'Free storage for everyone',
                'A warehouse that sells products'
              ],
              correct_answer: 1,
              explanation: 'Public warehouses are owned by the government, individuals, or companies, but are open to any public member to store their products in return for a storage fee or charge.'
            },
            {
              question: 'What is a bonded warehouse?',
              options: [
                'A warehouse for local products only',
                'A warehouse storing imported goods in safe custody while waiting for customs clearance',
                'A free storage facility',
                'A warehouse that sells bonds'
              ],
              correct_answer: 1,
              explanation: 'Bonded warehouses store imported goods in safe custody while waiting for customs clearance. Importers cannot move goods until customs duties are fully paid.'
            },
            {
              question: 'What is a climate-controlled warehouse?',
              options: [
                'A warehouse with windows only',
                'A warehouse for goods affected by weather, storing them at specific temperature or humidity',
                'Any outdoor storage',
                'A warehouse without temperature regulation'
              ],
              correct_answer: 1,
              explanation: 'Climate-controlled warehouses store goods usually affected by weather conditions at a specific temperature or humidity, ideal for perishable goods like vegetables, flowers, and frozen products.'
            },
            {
              question: 'What is a smart warehouse?',
              options: [
                'A warehouse with smart employees',
                'A warehouse using AI for automated packing, sorting, and transporting',
                'A traditional storage building',
                'A warehouse with good lighting'
              ],
              correct_answer: 1,
              explanation: 'Smart warehouses use Artificial Intelligence (AI) in storage and operations. Most processes are fully automated: packing, sorting, and transporting goods to customers with minimal supervision.'
            }
          ]
        },
        {
          title: 'Warehouse Management',
          questions: [
            {
              question: 'What is warehouse management?',
              options: [
                'Only cleaning the warehouse',
                'Supervising, controlling, and evaluating activities to ensure efficient supply of stock',
                'Just hiring warehouse staff',
                'Building more warehouses'
              ],
              correct_answer: 1,
              explanation: 'Warehouse management is supervising, controlling, and evaluating various activities in a warehouse to ensure an efficient and reliable supply of stock to satisfy customer demand.'
            },
            {
              question: 'What is included in warehouse management practices?',
              options: [
                'Ignoring product arrangement',
                'Arrangement of goods, cleaning, regulating atmospheric conditions, and modern facilities',
                'Only counting inventory once a year',
                'Avoiding safety regulations'
              ],
              correct_answer: 1,
              explanation: 'Warehouse management includes arranging goods efficiently, cleaning the warehouse, regulating atmospheric conditions, using modern facilities, and ensuring safety.'
            },
            {
              question: 'Why is cleaning a warehouse important?',
              options: [
                'Only for aesthetic reasons',
                'It ensures goods are stored in a clean and safe environment with a pleasant appearance',
                'It\'s not important',
                'Only when inspectors visit'
              ],
              correct_answer: 1,
              explanation: 'Cleaning ensures goods are stored in a clean and safe environment and that the warehouse has a pleasant appearance, protecting products and employees.'
            },
            {
              question: 'What is physical inventory counting?',
              options: [
                'Guessing stock levels',
                'Regularly counting materials to ensure quality records and identify well-preserved vs. spoiled goods',
                'Only checking financial records',
                'Ignoring stock levels'
              ],
              correct_answer: 1,
              explanation: 'Physical inventory counting means regularly counting materials in the warehouse to ensure quality records on ledgers and identify well-preserved materials vs. spoiled ones.'
            },
            {
              question: 'Why is training warehouse staff important?',
              options: [
                'It\'s not necessary',
                'To make them aware of safety and operation requirements to increase work efficiency',
                'Only for management positions',
                'To increase costs'
              ],
              correct_answer: 1,
              explanation: 'Training staff makes them aware of current safety and operation requirements of laws and regulations to increase work efficiency and ensure proper warehouse operations.'
            }
          ]
        },
        {
          title: 'The Concept of Inventorying',
          questions: [
            {
              question: 'What is inventory?',
              options: [
                'Only finished products',
                'Stocks mostly kept on warehouse premises available for sale, distribution, or further use',
                'Employee records',
                'Customer lists'
              ],
              correct_answer: 1,
              explanation: 'Inventories or stocks are mostly kept on warehouse premises so they are available for sale, distribution, or further use. They include raw materials, WIP, and finished goods.'
            },
            {
              question: 'What is inventory management?',
              options: [
                'Ignoring stock levels',
                'Management of goods to ensure sufficient quantities without holding more or less than required',
                'Ordering as much as possible',
                'Never checking stock'
              ],
              correct_answer: 1,
              explanation: 'Inventory management is the management of goods to ensure sufficient quantities without holding more or less inventory than required, maintaining optimal stock levels.'
            },
            {
              question: 'What is "receiving stock" in inventory management?',
              options: [
                'Refusing deliveries',
                'Accepting deliveries from suppliers, notifying purchasing dept, and keeping records',
                'Only signing papers',
                'Storing without checking'
              ],
              correct_answer: 1,
              explanation: 'Receiving stock involves accepting deliveries of goods from suppliers, notifying the purchasing department, keeping records, unloading, and inspecting condition against order documents.'
            },
            {
              question: 'What is "issuing stock"?',
              options: [
                'Buying new products',
                'The whole process of releasing goods from the warehouse, verifying requisitions and recording',
                'Throwing away old stock',
                'Ignoring orders'
              ],
              correct_answer: 1,
              explanation: 'Issuing stock involves the whole process of releasing goods from the warehouse, including verifying requisitions, releasing goods, and recording goods or stocks moved out.'
            },
            {
              question: 'What is stock control?',
              options: [
                'Never checking inventory',
                'Checking and keeping proper records of quantity and value of goods for a period',
                'Only ordering when out of stock',
                'Guessing stock levels'
              ],
              correct_answer: 1,
              explanation: 'Stock control involves checking and keeping proper records of the quantity and value of goods in a warehouse for a particular period, ensuring reasonable stock levels are maintained.'
            }
          ]
        },
        {
          title: 'Essential Documents and Inventory Methods',
          questions: [
            {
              question: 'What is a Goods Received Note (GRN)?',
              options: [
                'A customer complaint form',
                'A document prepared upon receipt of goods from a supplier providing evidence of goods received',
                'An invoice',
                'A delivery truck manifest'
              ],
              correct_answer: 1,
              explanation: 'A Goods Received Note (GRN) is a document prepared by a business owner upon receipt of goods from a supplier, providing evidence of goods received and helping verify quantities.'
            },
            {
              question: 'What is a bin card?',
              options: [
                'A credit card',
                'A document tracking inventory levels of a specific item in a specific bin',
                'A trash collection record',
                'An employee ID card'
              ],
              correct_answer: 1,
              explanation: 'A bin card is a document that tracks the inventory levels of a specific item in a specific bin, recording the dates and quantities of items received, issued, or transferred.'
            },
            {
              question: 'What is a delivery note?',
              options: [
                'A thank you letter',
                'A document accompanying goods dispatched to customers confirming items and quantities delivered',
                'An advertising flyer',
                'A warehouse floor plan'
              ],
              correct_answer: 1,
              explanation: 'Delivery notes are documents accompanying goods dispatched to customers. They confirm the items and quantities delivered and serve as proof of delivery.'
            },
            {
              question: 'What is manual inventory management?',
              options: [
                'Using only computers',
                'Physical counting and recording inventory items, low-cost but prone to errors',
                'Automatic robot counting',
                'Never counting inventory'
              ],
              correct_answer: 1,
              explanation: 'Manual inventory management involves physical counting and recording inventory items. While low-cost and easy to implement, business owners are more likely to make errors.'
            },
            {
              question: 'What is the ABC Analysis method?',
              options: [
                'Alphabetical sorting only',
                'Categorizing inventory items based on value: A (high-value), B (medium), C (low-value)',
                'Counting items three times',
                'A grading system for employees'
              ],
              correct_answer: 1,
              explanation: 'The ABC Analysis method categorizes inventory items based on their value: A items are high-value requiring close monitoring, B items are medium-value, and C items are low-value requiring minimal control.'
            }
          ]
        }
      ]
    },
    {
      chapter_number: 5,
      title: 'Business Opportunity Identification',
      description: 'Understanding business opportunities and ways to identify them',
      quizzes: [
        {
          title: 'The Concept of Business Opportunity',
          questions: [
            {
              question: 'What is a business opportunity?',
              options: [
                'Any random business idea',
                'Creating goods or services people need or want by identifying challenges and finding ways to solve them profitably',
                'A guaranteed way to make money',
                'Government grants for businesses'
              ],
              correct_answer: 1,
              explanation: 'A business opportunity is creating goods or services that people need or want in the community by identifying challenges or gaps in the community/market and finding a way to solve them profitably.'
            },
            {
              question: 'How do business opportunities arise?',
              options: [
                'Only from government programs',
                'From unmet community needs, changes in consumer demand, technological advancement, or new markets',
                'Randomly without any pattern',
                'Only during economic booms'
              ],
              correct_answer: 1,
              explanation: 'Business opportunities mainly arise from unmet community needs and wants, creating new goods/services or improving existing ones, changes in consumer demand, technological advancement, or introduction of new markets.'
            },
            {
              question: 'Why is identifying business opportunities important?',
              options: [
                'It guarantees wealth',
                'It can lead to job creation, problem-solving, creativity, independence, and social benefit',
                'It\'s only for large corporations',
                'It eliminates all business risks'
              ],
              correct_answer: 1,
              explanation: 'Identifying business opportunities is important for job creation, problem-solving (addressing daily challenges), promoting creativity, achieving independence, and providing social benefits to the community.'
            },
            {
              question: 'What does "problem-solving" mean in business opportunities?',
              options: [
                'Complaining about problems',
                'Businesses offering solutions to people\'s daily problems like providing clean water or healthy meals',
                'Ignoring community challenges',
                'Only fixing technical issues'
              ],
              correct_answer: 1,
              explanation: 'Problem-solving means businesses often offer solutions to people\'s daily problems. For example, a community may lack clean and safe drinking water, leading to health issues, so an entrepreneur may start a water purification business.'
            },
            {
              question: 'How does business opportunity identification promote creativity?',
              options: [
                'It limits innovation',
                'Entrepreneurs constantly seek new and better ways to meet customers\' needs, leading to innovative goods or services',
                'It copies existing businesses only',
                'It discourages new ideas'
              ],
              correct_answer: 1,
              explanation: 'Identifying new opportunities can lead to innovative goods or services. Entrepreneurs constantly seek new and better ways to meet customers\' needs and wants, promoting creativity.'
            }
          ]
        },
        {
          title: 'Finding Your Passions',
          questions: [
            {
              question: 'Why is building a business around your passions important?',
              options: [
                'It guarantees profits',
                'It increases chances of success and job satisfaction when passion matches the need',
                'Passion is not important in business',
                'It makes the business easier without effort'
              ],
              correct_answer: 1,
              explanation: 'Building a business around one\'s passions increases the chances of success and job satisfaction. When a person\'s passion matches the need, they are more likely to overcome obstacles.'
            },
            {
              question: 'Which question helps identify your passions?',
              options: [
                'How much money can I make?',
                'What activities do I like to do? What am I naturally good at doing?',
                'What do my parents want me to do?',
                'What is the easiest business to start?'
              ],
              correct_answer: 1,
              explanation: 'Questions to help identify passions include: What activities do you like to do? What are you naturally good at doing? What are your skills and talents? What is important to you?'
            },
            {
              question: 'How does identifying passion help in entrepreneurship?',
              options: [
                'It eliminates all challenges',
                'It helps understand what excites and motivates a person, essential for the entrepreneurial journey',
                'It makes funding easier',
                'It guarantees customer loyalty'
              ],
              correct_answer: 1,
              explanation: 'Identifying one\'s passion is an essential step in the entrepreneurial journey. It is about understanding what excites and motivates a person to pursue a meaningful business.'
            },
            {
              question: 'What role do hobbies and interests play in business?',
              options: [
                'They distract from business goals',
                'They can reveal activities you\'re naturally good at that could become a business',
                'They should be kept separate from business',
                'They have no business value'
              ],
              correct_answer: 1,
              explanation: 'Hobbies and interests help identify what activities you like to do and what you\'re naturally good at doing, which can form the foundation of a successful business.'
            },
            {
              question: 'Why consider your values when identifying opportunities?',
              options: [
                'Values don\'t matter in business',
                'Understanding what is important to you and what you deeply care about guides business decisions',
                'Only profits matter',
                'Values change constantly'
              ],
              correct_answer: 1,
              explanation: 'Considering your values (what is important to you and what things you deeply care about) helps guide your business toward meaningful work aligned with your principles.'
            }
          ]
        },
        {
          title: 'Observing Your Surroundings',
          questions: [
            {
              question: 'What does "observing your surroundings" mean for business opportunities?',
              options: [
                'Just looking around casually',
                'Closely observing the environment to identify unmet needs, inefficiencies, or market trends',
                'Spying on competitors only',
                'Ignoring local problems'
              ],
              correct_answer: 1,
              explanation: 'By closely observing the environment, an individual can identify unmet needs, inefficiencies, or market trends that present potential small business opportunities.'
            },
            {
              question: 'How can environmental observation lead to business ideas?',
              options: [
                'It can\'t',
                'Noticing problems like glass bottle littering can spark ideas like starting an upcycling business',
                'Only through formal research',
                'By copying what others do'
              ],
              correct_answer: 1,
              explanation: 'For instance, noticing environmental pollution caused by littering glass bottles in a rural area can spark an idea for starting an upcycling business, turning glass jars into decorative items.'
            },
            {
              question: 'What should you pay attention to when observing your community?',
              options: [
                'Only successful businesses',
                'People\'s needs and challenges, and what problems you see in your community',
                'Just what\'s advertised',
                'Only what\'s trending globally'
              ],
              correct_answer: 1,
              explanation: 'When observing surroundings, pay attention to people\'s needs and challenges and what problems you see in your community to identify business opportunities.'
            },
            {
              question: 'Why is observing inefficiencies important?',
              options: [
                'To criticize others',
                'Inefficiencies reveal gaps where better solutions can be offered',
                'It\'s not important',
                'Only for large companies'
              ],
              correct_answer: 1,
              explanation: 'Observing inefficiencies or market trends helps identify gaps where an individual can offer better solutions, creating valuable business opportunities.'
            },
            {
              question: 'What is an example of observation leading to opportunity?',
              options: [
                'Ignoring community problems',
                'Noticing people spend time collecting water and starting a water delivery service',
                'Only reading business books',
                'Waiting for opportunities to appear'
              ],
              correct_answer: 1,
              explanation: 'For example, noticing that people, especially children, spend significant time collecting water from distant sources could lead to starting a water collection and delivery service business.'
            }
          ]
        },
        {
          title: 'Using Your Network',
          questions: [
            {
              question: 'What does "using your network" mean for identifying opportunities?',
              options: [
                'Only using social media',
                'Talking to family or community to gain insights about trends, needs, suppliers, and competitors',
                'Avoiding all communication',
                'Only networking with wealthy people'
              ],
              correct_answer: 1,
              explanation: 'Networking can be a source of information for identifying potential small business opportunities. Talking to family or the community can gain valuable insights about trends, customer needs, suppliers, and competitors.'
            },
            {
              question: 'How can networking help identify business gaps?',
              options: [
                'It can\'t help',
                'Building strong relationships leads to collaboration and helps learn about trends and gaps competitors miss',
                'Only through formal meetings',
                'By keeping information secret'
              ],
              correct_answer: 1,
              explanation: 'Building strong relationships can lead to collaboration with other entrepreneurs in the community and provide valuable insights into trends, customer behavior, and potential gaps or unmet needs in the market.'
            },
            {
              question: 'Who should be included in your business network?',
              options: [
                'Only family members',
                'Diverse people including family, community members, suppliers, customers, and other entrepreneurs',
                'Only competitors',
                'Only business professors'
              ],
              correct_answer: 1,
              explanation: 'Your network should include family, community members, potential customers, suppliers, and other small business entrepreneurs to gain diverse perspectives and insights.'
            },
            {
              question: 'What kind of information can you learn from your network?',
              options: [
                'Nothing useful',
                'Information about customer needs, suppliers, market trends, and potential partners',
                'Only gossip',
                'Just contact information'
              ],
              correct_answer: 1,
              explanation: 'From your network, you can learn about trends, customer needs, suppliers, competitors, unmet needs in the market, and potential small business partners in the community.'
            },
            {
              question: 'Why is networking with other entrepreneurs valuable?',
              options: [
                'To copy their ideas exactly',
                'To gain insights about challenges, solutions, and potential collaboration opportunities',
                'Only for social purposes',
                'It\'s not valuable'
              ],
              correct_answer: 1,
              explanation: 'Networking with other entrepreneurs provides valuable insights about challenges they face, solutions they\'ve found, and opportunities for collaboration, helping identify gaps others might have missed.'
            }
          ]
        },
        {
          title: 'Market Research',
          questions: [
            {
              question: 'What is market research?',
              options: [
                'Guessing what customers want',
                'Crucial process for identifying and validating viable small business opportunities by determining preferences and buying habits',
                'Only for large corporations',
                'Reading newspapers'
              ],
              correct_answer: 1,
              explanation: 'Market research is crucial for identifying and validating viable small business opportunities. By conducting thorough research, individuals can determine customer preferences, buying habits, and overall market size.'
            },
            {
              question: 'How does market research help entrepreneurs?',
              options: [
                'It guarantees success',
                'It helps refine business ideas, tailor them to meet customer needs, and study competitors',
                'It\'s just paperwork',
                'It eliminates all risks'
              ],
              correct_answer: 1,
              explanation: 'Market research helps refine one\'s business idea and tailor it to meet customer needs and wants. It also helps study competitors, providing valuable insights into trends, behavior, and gaps.'
            },
            {
              question: 'What is a survey in market research?',
              options: [
                'A building inspection',
                'Making questionnaires with straightforward questions addressing research objectives',
                'Just asking random questions',
                'A population census'
              ],
              correct_answer: 1,
              explanation: 'Using surveys involves making questionnaires or surveys by developing straightforward, concise questions addressing your research objectives, then distributing to potential or existing customers.'
            },
            {
              question: 'What should interviews in market research include?',
              options: [
                'Only yes/no questions',
                'In-depth conversations with open-ended questions to gain insights and explore motivations',
                'Interrogating people',
                'Only formal presentations'
              ],
              correct_answer: 1,
              explanation: 'Conducting interviews means having in-depth conversations with potential customers, industry experts, or competitors to gain insights using open-ended questions and actively listening.'
            },
            {
              question: 'Why use observations in market research?',
              options: [
                'To spy on people',
                'To observe customer behavior and identify unmet needs or opportunities to fill gaps',
                'It\'s not effective',
                'Only for security purposes'
              ],
              correct_answer: 1,
              explanation: 'Observations involve watching customer behavior by how people interact with products or services in stores or online, analyzing competitors, and identifying unmet needs to find opportunities to fill gaps in the market.'
            }
          ]
        }
      ]
    }
  ]
};

// Export for use in database seeding
module.exports = quizzes;

console.log('\n✅ Business Studies Form Two Quizzes Generated!');
console.log(`📚 Course: ${quizzes.course.title}`);
console.log(`📖 Chapters: ${quizzes.chapters.length}`);
console.log(`📝 Total Quizzes: ${quizzes.chapters.reduce((sum, ch) => sum + ch.quizzes.length, 0)}`);
console.log(`❓ Total Questions: ${quizzes.chapters.reduce((sum, ch) =>
  sum + ch.quizzes.reduce((qsum, q) => qsum + q.questions.length, 0), 0)}`);
console.log('\nQuiz structure:');
quizzes.chapters.forEach(chapter => {
  console.log(`\nChapter ${chapter.chapter_number}: ${chapter.title}`);
  chapter.quizzes.forEach((quiz, idx) => {
    console.log(`  Quiz ${idx + 1}: ${quiz.title} (${quiz.questions.length} questions)`);
  });
});
