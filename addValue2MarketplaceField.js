//mongo shell jsvascript 
//mongo  127.0.0.1/tourbooks addValue2MarketplaceField.js > addValue2MarketplaceField.log
//Purpose: add value "Rezdy" to field - marketplace for Tours and add a field detailsTypeId pointing to RTours
//
var clt = db.getCollection('Contents');
var cur = clt.find({"typeId":"58785c576d0e815f4014b288"});
var count = 0;
while(cur.hasNext()){
    var data = cur.next();
    
    data.detailsTypeId = "587866b06d0e810d4114b288";
    data.workspace.fields.marketplace = "Rezdy";
    data.live.fields.marketplace = "Rezdy";
    try{
        var result = clt.updateOne(
        {"_id": data._id},
        {$set: data}
        );
        print('Tour - ' + data.text +' UPDATED! - modifiedCount = ' + result.modifiedCount);
        count++;
    } catch(e){
        print('Exception Happened during updating!! - ' + e);
    }
}
print("count = " + count);