using System;
using System.Linq;
using System.Collections.Generic;
using System.Runtime.InteropServices;

using AOT;

using UnityEngine;
using UnityEngine.UI;

using Unity.Mathematics;

public class WebCamController : MonoBehaviour
{
    [DllImport("__Internal")]
    static extern void SetMindARCallBack(Action<int,float[]> cb);
    [DllImport("__Internal")]
    static extern void SetBarCodeCallBack(Action<string> cb);

    [RuntimeInitializeOnLoadMethod]
    static void Init()
    {
        SetMindARCallBack(MindARCallBack);
        SetBarCodeCallBack(BarCodeCallBack);
    }

    static List<(int index,float[] matrix)> UpdateQue = new List<(int index,float[] matrix)>();
    static List<string> BarcodesQue = new List<string>();

    [MonoPInvokeCallback(typeof(Action<int,float[]>))]
    static void MindARCallBack(int index,[MarshalAs(UnmanagedType.LPArray,SizeConst = 16)]float[] matrix) => UpdateQue.Add((index,matrix));
    [MonoPInvokeCallback(typeof(Action<int,float[]>))]
    static void BarCodeCallBack(string value) => BarcodesQue.Add(value);
    
    public RawImage image;
    public TMPro.TMP_Text qrCodes;
    public TMPro.TMP_Text[] names;
    void Start()
    {
        var env = WebCamTexture.devices.FirstOrDefault((device) => !device.isFrontFacing);
        var texture = new WebCamTexture(env.name);
        image.texture = texture;
        texture.Play();
    }

    void Update()
    {
        foreach(var group in UpdateQue.GroupBy((pair) => pair.index,(pair) => pair.matrix))
        {
            var floats = group.LastOrDefault((m) => m != null);
            var nameText = names[group.Key];
            nameText.gameObject.SetActive(floats != null);
            if(floats == null)
                continue;

            var matrix = new Matrix4x4();
            foreach(var i in Enumerable.Range(0,floats.Length))
                matrix[i] = floats[i];

            nameText.transform.localRotation = matrix.rotation;
            nameText.transform.localPosition = matrix.GetPosition() / 10;

            nameText.text = nameText.name + "\n" + matrix.GetPosition();
        }

        if(BarcodesQue.Count > 0)
            qrCodes.text = string.Join("\n",BarcodesQue.Select((code) => code));

        BarcodesQue.Clear();
        UpdateQue.Clear();
    }
}
